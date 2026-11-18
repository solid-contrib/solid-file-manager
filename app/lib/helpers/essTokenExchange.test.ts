import { describe, expect, it, vi } from "vitest";
import { createDpopHeader, generateDpopKeyPair } from "@inrupt/solid-client-authn-core";
import {
  boundKeyThumbprint,
  createEssAwareFetch,
  DEFAULT_TRUSTED_AUTHORIZATION_SERVERS,
  EssTokenExchangeError,
  isTrustedAuthorizationServer,
  parseEssChallenge,
  proofKeyThumbprint,
  tokenHash,
} from "./essTokenExchange";

const AS = "https://platform.odi.ess.example";
const STORAGE = "https://storage.odi.ess.example";
const FILE = `${STORAGE}/abc/sp/notes.txt`;
const NOW = Date.UTC(2026, 10, 16, 12);
const jwtWith = (payload: object) => `h.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.s`;
const idToken = jwtWith({ iss: "https://openid.odi.ess.example" });
const challenge = (asUri = AS, realm = STORAGE) =>
  new Response(null, { status: 401, headers: { "WWW-Authenticate": `Bearer realm="${realm}", as_uri="${asUri}"` } });

/** A fake ESS platform: metadata, token endpoint and storage that only accepts its own tokens. */
function essPlatform(overrides: { metadataIssuer?: string; expiresIn?: number; storage?: (auth: string | null) => Response } = {}) {
  let issued = 0;
  const exchanges: URLSearchParams[] = [];
  const exchangeHeaders: Headers[] = [];
  const storageRequests: Request[] = [];
  const plainFetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init);
    if (request.url === `${AS}/.well-known/oauth-authorization-server`) {
      return Response.json({ issuer: overrides.metadataIssuer ?? AS, token_endpoint: `${AS}/access/token` });
    }
    if (request.url === `${AS}/access/token`) {
      exchanges.push(new URLSearchParams(await request.text()));
      exchangeHeaders.push(request.headers);
      issued += 1;
      return Response.json({ access_token: `ess-${issued}`, expires_in: overrides.expiresIn ?? 300 });
    }
    storageRequests.push(request);
    const auth = request.headers.get("Authorization");
    return overrides.storage?.(auth) ?? new Response("ok", { status: auth?.startsWith("Bearer ess-") ? 200 : 401 });
  }) as unknown as typeof fetch;
  return { plainFetch, exchanges, exchangeHeaders, storageRequests };
}

function setUp(options: Partial<Parameters<typeof createEssAwareFetch>[0]> = {}, platform = essPlatform()) {
  let now = NOW;
  const solidFetch = vi.fn(async () => challenge()) as unknown as typeof fetch;
  const ess = createEssAwareFetch({
    solidFetch,
    plainFetch: platform.plainFetch,
    getIdToken: () => ({ token: idToken }),
    trustedAuthorizationServers: [AS],
    now: () => now,
    ...options,
  });
  return { ...platform, ess, solidFetch, advance: (ms: number) => (now += ms) };
}

describe("parseEssChallenge", () => {
  it("reads realm and as_uri from an ESS 401", () => {
    expect(parseEssChallenge(challenge())).toEqual({ asUri: AS, realm: STORAGE });
  });

  it.each([
    ["a plain 401", new Response(null, { status: 401, headers: { "WWW-Authenticate": 'DPoP realm="x"' } })],
    ["a 403 with a challenge", new Response(null, { status: 403, headers: challenge().headers })],
    ["a 200", new Response("ok")],
  ])("ignores %s", (_label, response) => {
    expect(parseEssChallenge(response)).toBeNull();
  });
});

describe("isTrustedAuthorizationServer", () => {
  it.each([
    [AS, [AS], true],
    [AS, [`${AS}/`], true],
    [AS, [], false],
    ["https://platform.odi.ess.example.evil.com", [AS], false],
    ["https://evil.example", [AS], false],
    ["http://platform.odi.ess.example", ["http://platform.odi.ess.example"], false],
    ["not a url", [AS], false],
  ])("%s with allow list %o → %s", (asUri, allowList, expected) => {
    expect(isTrustedAuthorizationServer(asUri, allowList)).toBe(expected);
  });

  it("trusts ODI's platform by default and nothing else", () => {
    expect(DEFAULT_TRUSTED_AUTHORIZATION_SERVERS).toEqual(["https://platform.odi.ess.solid-experiments.org"]);
  });
});

describe("createEssAwareFetch", () => {
  it("leaves servers without an ESS challenge alone (e.g. Community Solid Server)", async () => {
    const plain401 = new Response(null, { status: 401 });
    const { ess, plainFetch } = setUp({ solidFetch: vi.fn(async () => plain401) as unknown as typeof fetch });

    expect(await ess.fetch(FILE)).toBe(plain401);
    expect(plainFetch).not.toHaveBeenCalled();
  });

  it("exchanges the ID token and retries with a Bearer token, without DPoP or cookies", async () => {
    const { ess, exchanges, exchangeHeaders, storageRequests } = setUp();

    const response = await ess.fetch(FILE, { method: "PUT", body: "hi", headers: { DPoP: "proof", "Content-Type": "text/plain" } });

    expect(response.status).toBe(200);
    // This ID token isn't key-bound, so the exchange carries no proof.
    expect(exchangeHeaders[0].get("DPoP")).toBeNull();
    expect(Object.fromEntries(exchanges[0])).toEqual({
      grant_type: "urn:ietf:params:oauth:grant-type:token-exchange",
      subject_token: idToken,
      subject_token_type: "urn:ietf:params:oauth:token-type:id_token",
      resource: STORAGE,
    });
    const [sent] = storageRequests;
    expect(sent.method).toBe("PUT");
    expect(await sent.text()).toBe("hi");
    expect(sent.headers.get("Authorization")).toBe("Bearer ess-1");
    expect(sent.headers.get("DPoP")).toBeNull();
    expect(sent.headers.get("Content-Type")).toBe("text/plain");
    expect(sent.credentials).toBe("omit");
  });

  it("goes straight to Bearer for a known realm and reuses the token", async () => {
    const { ess, solidFetch, exchanges } = setUp();

    await ess.fetch(FILE);
    await ess.fetch(`${STORAGE}/abc/sp/other.txt`);

    expect(solidFetch).toHaveBeenCalledTimes(1);
    expect(exchanges).toHaveLength(1);
  });

  it("exchanges again shortly before the platform token expires", async () => {
    const { ess, exchanges, storageRequests, advance } = setUp();

    await ess.fetch(FILE);
    advance(275_000);
    await ess.fetch(FILE);

    expect(exchanges).toHaveLength(2);
    expect(storageRequests.at(-1)?.headers.get("Authorization")).toBe("Bearer ess-2");
  });

  it("retries once with a fresh token after a Bearer 401, then gives up", async () => {
    const platform = essPlatform({ storage: () => new Response(null, { status: 401 }) });
    const { ess, exchanges, storageRequests } = setUp({}, platform);

    const response = await ess.fetch(FILE);

    expect(response.status).toBe(401);
    expect(exchanges).toHaveLength(2);
    expect(storageRequests).toHaveLength(2);
  });

  it("shares one exchange between concurrent requests", async () => {
    const { ess, exchanges } = setUp();

    await Promise.all([ess.fetch(FILE), ess.fetch(FILE), ess.fetch(FILE)]);

    expect(exchanges).toHaveLength(1);
  });

  it.each([
    ["an authorisation server not on the allow list", challenge("https://evil.example")],
    ["a sibling subdomain of a trusted server", challenge("https://attacker.odi.ess.example")],
    ["a realm other than the request's origin", challenge(AS, "https://other-storage.example")],
  ])("never sends the ID token to %s", async (_label, response) => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { ess, plainFetch } = setUp({ solidFetch: vi.fn(async () => response) as unknown as typeof fetch });

    expect((await ess.fetch(FILE)).status).toBe(401);
    expect(plainFetch).not.toHaveBeenCalled();
  });

  describe("with a key-bound ID token (cnf.jkt)", () => {
    async function boundSetUp(options: { jkt?: string; withSigner?: boolean; onSignInRequired?: () => void } = {}) {
      const key = await generateDpopKeyPair();
      const dpopProof = vi.fn((url: string, method: string, ath?: string) =>
        (createDpopHeader as (...args: unknown[]) => Promise<string>)(url, method, key, ath),
      );
      const jkt = options.jkt ?? (await proofKeyThumbprint(await createDpopHeader(AS, "GET", key)));
      const token = jwtWith({ iss: "https://openid.odi.ess.example", cnf: { jkt } });
      const setup = setUp({
        getIdToken: () => ({ token, dpopProof: options.withSigner === false ? undefined : dpopProof }),
        onSignInRequired: options.onSignInRequired,
      });
      return { ...setup, dpopProof, key, token };
    }
    const decode = (jwt: string, index: number) => JSON.parse(Buffer.from(jwt.split(".")[index], "base64url").toString());

    it("sends a DPoP proof from the bound key with the exchange, and still none to storage", async () => {
      const { ess, exchangeHeaders, storageRequests, key, token } = await boundSetUp();

      expect((await ess.fetch(FILE)).status).toBe(200);

      const proof = exchangeHeaders[0].get("DPoP")!;
      expect(decode(proof, 0)).toMatchObject({ typ: "dpop+jwt", jwk: key.publicKey });
      // ath: the hash of the subject token (ESS requires it).
      expect(decode(proof, 1)).toMatchObject({ htm: "POST", htu: `${AS}/access/token`, ath: await tokenHash(token) });
      expect(storageRequests.at(-1)!.headers.get("Authorization")).toBe("Bearer ess-1");
      expect(storageRequests.at(-1)!.headers.get("DPoP")).toBeNull();
    });

    it("refuses to exchange when the key binding can't be read", async () => {
      const { ess, exchanges } = setUp({ getIdToken: () => ({ token: jwtWith({ cnf: { jkt: 42 } }), dpopProof: vi.fn() }) });

      await expect(ess.fetch(FILE)).rejects.toThrow(/key binding can't be read/);
      expect(exchanges).toHaveLength(0);
    });

    it("refuses to exchange without a key to sign with", async () => {
      const { ess, exchanges } = await boundSetUp({ withSigner: false });

      await expect(ess.fetch(FILE)).rejects.toThrow(/No key to prove the ID token with/);
      expect(exchanges).toHaveLength(0);
    });

    it("refuses to exchange when the key doesn't match the ID token", async () => {
      const onSignInRequired = vi.fn();
      const { ess, exchanges } = await boundSetUp({ jkt: "another-key", onSignInRequired });

      await expect(ess.fetch(FILE)).rejects.toThrow(/doesn't match the ID token/);
      expect(exchanges).toHaveLength(0);
      // Only a new sign-in brings a matching token and key.
      expect(onSignInRequired).toHaveBeenCalledOnce();
    });
  });

  it("ignores a challenge from a server a redirect led to", async () => {
    const redirected = challenge();
    Object.defineProperty(redirected, "url", { value: "https://elsewhere.example/x" });
    const { ess, exchanges } = setUp({ solidFetch: vi.fn(async () => redirected) as unknown as typeof fetch });

    expect((await ess.fetch(FILE)).status).toBe(401);
    expect(exchanges).toHaveLength(0);
  });

  it("refuses an authorisation server whose metadata names a different issuer", async () => {
    const { ess, exchanges } = setUp({}, essPlatform({ metadataIssuer: "https://elsewhere.example" }));

    await expect(ess.fetch(FILE)).rejects.toThrow(EssTokenExchangeError);
    expect(exchanges).toHaveLength(0);
  });

  it("fails clearly, without leaking tokens, when there is no valid ID token", async () => {
    const { ess } = setUp({ getIdToken: () => undefined });

    const error = await ess.fetch(FILE).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(EssTokenExchangeError);
    expect(String(error)).not.toMatch(/ess-|h\./);
  });

  it("does not retry a request whose body is a stream", async () => {
    const { ess, plainFetch } = setUp();
    const body = new ReadableStream({ start: (c) => c.close() });

    expect((await ess.fetch(FILE, { method: "PUT", body, duplex: "half" } as RequestInit)).status).toBe(401);
    expect(plainFetch).not.toHaveBeenCalled();
  });

  it("does nothing extra when switched off", async () => {
    const { ess, plainFetch } = setUp({ enabled: false });

    expect((await ess.fetch(FILE)).status).toBe(401);
    expect(plainFetch).not.toHaveBeenCalled();
  });

  it("never follows redirects when fetching metadata or exchanging the ID token", async () => {
    const { ess, plainFetch } = setUp();

    await ess.fetch(FILE);

    const calls = vi.mocked(plainFetch).mock.calls as unknown as [string, RequestInit | undefined][];
    const tokenCalls = calls.filter(([url]) => String(url).startsWith(AS));
    expect(tokenCalls).toHaveLength(2);
    for (const [, init] of tokenCalls) expect(init?.redirect).toBe("error");
  });

  it("does not use or keep a token from an exchange that finished after logout", async () => {
    let release!: () => void;
    const platform = essPlatform();
    const slow = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === `${AS}/access/token`) await new Promise<void>((resolve) => (release = resolve));
      return platform.plainFetch(input, init);
    }) as unknown as typeof fetch;
    const { ess, storageRequests } = setUp({}, { ...platform, plainFetch: slow });

    const request = ess.fetch(FILE);
    await vi.waitFor(() => expect(release).toBeTypeOf("function"));
    ess.clear();
    release();

    await expect(request).rejects.toThrow(EssTokenExchangeError);
    expect(storageRequests).toHaveLength(0);
  });

  it.each([
    ["while discovering the token endpoint", `${AS}/.well-known/oauth-authorization-server`],
    ["while the first (DPoP) request is out", "solid"],
  ])("never sends the ID token if the user signed out %s", async (_label, hold) => {
    let release!: () => void;
    const gate = () => new Promise<void>((resolve) => (release = resolve));
    const platform = essPlatform();
    const plainFetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === hold) await gate();
      return platform.plainFetch(input, init);
    }) as unknown as typeof fetch;
    const solidFetch = vi.fn(async () => {
      if (hold === "solid") await gate();
      return challenge();
    }) as unknown as typeof fetch;
    const { ess, exchanges, storageRequests } = setUp({ solidFetch }, { ...platform, plainFetch });

    const request = ess.fetch(FILE);
    await vi.waitFor(() => expect(release).toBeTypeOf("function"));
    ess.clear();
    release();

    await expect(request).rejects.toThrow(EssTokenExchangeError);
    expect(exchanges).toHaveLength(0);
    expect(storageRequests).toHaveLength(0);
  });

  it("reports only a plain OAuth error code from the token endpoint, never other text", async () => {
    const hostile = vi.fn(async (input: RequestInfo | URL) =>
      String(input).endsWith("oauth-authorization-server")
        ? Response.json({ issuer: AS, token_endpoint: `${AS}/access/token` })
        : Response.json({ error: `echo ${idToken}` }, { status: 400 }),
    ) as unknown as typeof fetch;
    const { ess } = setUp({ plainFetch: hostile });

    const error = await ess.fetch(FILE).catch((e: unknown) => e);

    expect(String(error)).toBe("EssTokenExchangeError: Token exchange failed (400).");
  });

  it.each([
    ["null", "null"],
    ["not JSON", "<html>oops</html>"],
    ["an array", "[1]"],
  ])("fails with a fixed message when the token endpoint's error body is %s", async (_label, body) => {
    const odd = vi.fn(async (input: RequestInfo | URL) =>
      String(input).endsWith("oauth-authorization-server")
        ? Response.json({ issuer: AS, token_endpoint: `${AS}/access/token` })
        : new Response(body, { status: 400, headers: { "Content-Type": "application/json" } }),
    ) as unknown as typeof fetch;
    const { ess } = setUp({ plainFetch: odd });

    const error = await ess.fetch(FILE).catch((e: unknown) => e);

    expect(String(error)).toBe("EssTokenExchangeError: Token exchange failed (400).");
  });

  it("resolves relative URLs instead of throwing", async () => {
    vi.stubGlobal("location", { href: `${STORAGE}/abc/sp/` });
    const { ess, exchanges } = setUp();

    expect((await ess.fetch("notes.txt")).status).toBe(200);
    expect(exchanges[0].get("resource")).toBe(STORAGE);
    vi.unstubAllGlobals();
  });

  describe("asking the user to sign in again", () => {
    it("does so when there is no valid ID token to exchange", async () => {
      const onSignInRequired = vi.fn();
      const { ess } = setUp({ getIdToken: () => undefined, onSignInRequired });

      await expect(ess.fetch(FILE)).rejects.toThrow(EssTokenExchangeError);
      expect(onSignInRequired).toHaveBeenCalledOnce();
    });

    it("does so when even a freshly exchanged token is refused", async () => {
      const onSignInRequired = vi.fn();
      const platform = essPlatform({ storage: () => new Response(null, { status: 401 }) });
      const { ess } = setUp({ onSignInRequired }, platform);

      expect((await ess.fetch(FILE)).status).toBe(401);
      expect(onSignInRequired).toHaveBeenCalledOnce();
    });

    it.each([
      ["a plain 401 without an ESS challenge", new Response(null, { status: 401 })],
      ["a 403", new Response(null, { status: 403 })],
      ["a challenge from an authorisation server not on the allow list", challenge("https://evil.example")],
    ])("never does so for %s", async (_label, response) => {
      vi.spyOn(console, "warn").mockImplementation(() => {});
      const onSignInRequired = vi.fn();
      const { ess } = setUp({ solidFetch: vi.fn(async () => response) as unknown as typeof fetch, onSignInRequired });

      await ess.fetch(FILE);
      expect(onSignInRequired).not.toHaveBeenCalled();
    });

    it("never does so for an untrusted challenge, even without an ID token", async () => {
      vi.spyOn(console, "warn").mockImplementation(() => {});
      const onSignInRequired = vi.fn();
      const { ess } = setUp({
        getIdToken: () => undefined,
        onSignInRequired,
        solidFetch: vi.fn(async () => challenge("https://evil.example")) as unknown as typeof fetch,
      });

      expect((await ess.fetch(FILE)).status).toBe(401);
      expect(onSignInRequired).not.toHaveBeenCalled();
    });

    it("never does so for a request from a session that has since ended", async () => {
      const onSignInRequired = vi.fn();
      let release!: () => void;
      let storageCalls = 0;
      const platform = essPlatform({ storage: () => new Response(null, { status: 401 }) });
      const plainFetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        if (String(input).startsWith(STORAGE) && (storageCalls += 1) === 2) {
          await new Promise<void>((resolve) => (release = resolve));
        }
        return platform.plainFetch(input, init);
      }) as unknown as typeof fetch;
      const { ess } = setUp({ onSignInRequired }, { ...platform, plainFetch });

      const request = ess.fetch(FILE);
      await vi.waitFor(() => expect(release).toBeTypeOf("function"));
      ess.clear();
      release();

      expect((await request).status).toBe(401);
      expect(onSignInRequired).not.toHaveBeenCalled();
    });

    it("never does so when a Bearer 401 is fixed by one fresh exchange", async () => {
      const onSignInRequired = vi.fn();
      let calls = 0;
      const platform = essPlatform({ storage: () => new Response(null, { status: (calls += 1) === 1 ? 401 : 200 }) });
      const { ess } = setUp({ onSignInRequired }, platform);

      expect((await ess.fetch(FILE)).status).toBe(200);
      expect(onSignInRequired).not.toHaveBeenCalled();
    });
  });

  it("forgets platform tokens on clear()", async () => {
    const { ess, solidFetch, exchanges } = setUp();

    await ess.fetch(FILE);
    ess.clear();
    await ess.fetch(FILE);

    expect(solidFetch).toHaveBeenCalledTimes(2);
    expect(exchanges).toHaveLength(2);
  });
});

describe("tokenHash", () => {
  it("is the base64url SHA-256 of the token", async () => {
    // SHA-256("abc"), from FIPS 180-2.
    expect(await tokenHash("abc")).toBe("ungWv48Bz-pBQUDeXa4iI7ADYaOWF3qctBD_YfIAFa0");
  });
});

describe("key thumbprints", () => {
  it("reads cnf.jkt, or nothing for an unbound token", () => {
    expect(boundKeyThumbprint(jwtWith({ cnf: { jkt: "abc" } }))).toBe("abc");
    expect(boundKeyThumbprint(idToken)).toBeUndefined();
  });

  it.each([
    ["not a JWT", "not-a-jwt"],
    ["cnf without jkt", jwtWith({ cnf: {} })],
    ["cnf: null", jwtWith({ cnf: null })],
    ["a non-string jkt", jwtWith({ cnf: { jkt: 42 } })],
    ["an empty jkt", jwtWith({ cnf: { jkt: "" } })],
  ])("refuses a token with %s, rather than treating it as unbound", (_label, token) => {
    expect(() => boundKeyThumbprint(token)).toThrow(EssTokenExchangeError);
  });

  it("computes the RFC 7638 thumbprint of a proof's key (the RFC's own example)", async () => {
    const jwk = {
      kty: "RSA",
      n: "0vx7agoebGcQSuuPiLJXZptN9nndrQmbXEps2aiAFbWhM78LhWx4cbbfAAtVT86zwu1RK7aPFFxuhDR1L6tSoc_BJECPebWKRXjBZCiFV4n3oknjhMstn64tZ_2W-5JsGY4Hc5n9yBXArwl93lqt7_RN5w6Cf0h4QyQ5v-65YGjQR0_FDW2QvzqY368QQMicAtaSqzs8KJZgnYb9c7d0zgdAZHzu6qMQvRL5hajrn1n91CbOpbISD08qNLyrdkt-bFTWhAI4vMQFh6WeZu0fM4lFd2NcRwr3XPksINHaQ-G_xBniIqbw0Ls1jF44-csFCur-kEgU8awapJzKnqDKgw",
      e: "AQAB",
      alg: "RS256",
      kid: "2011-04-29",
    };
    const proof = `${Buffer.from(JSON.stringify({ typ: "dpop+jwt", jwk })).toString("base64url")}.e30.s`;
    expect(await proofKeyThumbprint(proof)).toBe("NzbLsXh8uDCcd-6MNwXF4W_7noWXFZAfHkxZsRGC9Xs");
  });

  it("gives nothing for a proof without a usable key", async () => {
    expect(await proofKeyThumbprint("e30.e30.s")).toBeUndefined();
    expect(await proofKeyThumbprint(`${Buffer.from('{"jwk":{"kty":"EC"}}').toString("base64url")}.e30.s`)).toBeUndefined();
  });
});
