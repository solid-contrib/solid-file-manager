import { readFileSync } from "node:fs";
import { EventEmitter } from "node:events";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildAuthenticatedFetch, EVENTS, generateDpopKeyPair, type KeyPair } from "@inrupt/solid-client-authn-core";
import { createIdTokenStore } from "./idTokenStore";

const NOW = Date.UTC(2026, 10, 16, 12, 0, 0);
/** An unsigned JWT with the given `exp` (seconds); the store only reads the payload. */
const jwt = (exp: number) =>
  `header.${Buffer.from(JSON.stringify({ exp })).toString("base64url")}.signature`;

describe("createIdTokenStore", () => {
  const store = () => createIdTokenStore(() => NOW);

  it("returns a token that is still valid", () => {
    const s = store();
    const token = jwt(NOW / 1000 + 300);
    s.set(token);
    expect(s.get()).toEqual({ token, dpopProof: undefined });
  });

  it("keeps the DPoP proof signer with its ID token", () => {
    const s = store();
    const dpopProof = vi.fn();
    s.set(jwt(NOW / 1000 + 300), dpopProof);
    expect(s.get()?.dpopProof).toBe(dpopProof);
    s.set(jwt(NOW / 1000 + 300));
    expect(s.get()?.dpopProof).toBeUndefined();
  });

  it("keeps the current ID token when a refresh brings none", () => {
    const s = store();
    const token = jwt(NOW / 1000 + 300);
    const dpopProof = vi.fn();
    s.set(token, dpopProof);
    s.set(undefined, dpopProof);
    expect(s.get()).toEqual({ token, dpopProof });
  });

  it.each([
    ["expired", jwt(NOW / 1000 - 1)],
    ["within 30 seconds of expiry", jwt(NOW / 1000 + 20)],
    ["without an exp claim", `header.${Buffer.from("{}").toString("base64url")}.signature`],
    ["not a JWT", "not-a-jwt"],
  ])("returns nothing for a token that is %s", (_label, token) => {
    const s = store();
    s.set(token);
    expect(s.get()).toBeUndefined();
  });

  it("forgets an expired token rather than keeping it in memory", () => {
    let now = NOW;
    const s = createIdTokenStore(() => now);
    s.set(jwt(NOW / 1000 + 300));
    now += 300_000;
    expect(s.get()).toBeUndefined();
    now = NOW;
    expect(s.get()).toBeUndefined();
  });

  it("returns nothing once cleared", () => {
    const s = store();
    s.set(jwt(NOW / 1000 + 300));
    s.clear();
    expect(s.get()).toBeUndefined();
  });
});

// These guard the patches in patches/: if an upgrade or reinstall loses them,
// these tests fail instead of token exchange silently having no ID token.
describe("patched @inrupt/solid-client-authn-* (patches/)", () => {
  afterEach(() => vi.useRealTimers());

  /** A session whose access token expires after 10 s and refreshes to "a2" / "id-2". */
  function refreshingSession(events: EventEmitter, dpopKey?: KeyPair) {
    const tokenRefresher = {
      refresh: vi.fn(async () => ({ accessToken: "a2", idToken: "id-2", refreshToken: "r2", expiresIn: 300 })),
    };
    const fetch = vi.fn(async () => new Response("ok"));
    const authFetch = buildAuthenticatedFetch("a1", {
      refreshOptions: { sessionId: "s", refreshToken: "r1", tokenRefresher },
      eventEmitter: events,
      expiresIn: 10,
      dpopKey,
      fetch,
    });
    return { authFetch, fetch, tokenRefresher };
  }

  it("emits the new ID token after every token refresh", async () => {
    vi.useFakeTimers();
    const events = new EventEmitter();
    const onNewTokens = vi.fn();
    events.on(EVENTS.NEW_TOKENS, onNewTokens);
    const { tokenRefresher } = refreshingSession(events);

    await vi.advanceTimersByTimeAsync(10_000);

    expect(tokenRefresher.refresh).toHaveBeenCalledOnce();
    expect(onNewTokens).toHaveBeenCalledWith({ idToken: "id-2", dpopProof: undefined });
  });

  it("emits a DPoP proof signer for the session's key after a refresh", async () => {
    const dpopKey = await generateDpopKeyPair();
    vi.useFakeTimers();
    const events = new EventEmitter();
    const onNewTokens = vi.fn();
    events.on(EVENTS.NEW_TOKENS, onNewTokens);
    refreshingSession(events, dpopKey);

    await vi.advanceTimersByTimeAsync(10_000);

    const { dpopProof } = onNewTokens.mock.calls[0][0] as {
      dpopProof: (url: string, method: string, ath?: string) => Promise<string>;
    };
    const decode = (jwt: string) =>
      jwt.split(".").slice(0, 2).map((part) => JSON.parse(Buffer.from(part, "base64url").toString()));
    const [header, payload] = decode(await dpopProof("https://as.example/token", "POST"));
    expect(header).toMatchObject({ typ: "dpop+jwt", jwk: dpopKey.publicKey });
    expect(header.jwk.d).toBeUndefined();
    expect(payload).toMatchObject({ htm: "POST", htu: "https://as.example/token" });
    expect(payload.ath).toBeUndefined();
    // An `ath` is added only when asked for.
    expect(decode(await dpopProof("https://as.example/token", "POST", "hash"))[1].ath).toBe("hash");
  });

  it("still completes a refresh when a listener throws", async () => {
    vi.useFakeTimers();
    const events = new EventEmitter();
    events.on(EVENTS.NEW_TOKENS, () => {
      throw new Error("listener failed");
    });
    const { authFetch, fetch } = refreshingSession(events);

    await vi.advanceTimersByTimeAsync(10_000);
    await authFetch("https://pod.example/a.txt");

    const headers = new Headers((fetch.mock.calls[0] as unknown as [string, RequestInit])[1].headers);
    expect(headers.get("Authorization")).toBe("Bearer a2");
  });

  // Each emit must be wrapped in try/catch; on login it must come after the
  // session is saved (after the "Could not retrieve session" check).
  const guardedEmit = (payload: string) =>
    `try \\{\\s*eventEmitter\\?\\.emit\\((\\w+\\.)?EVENTS\\.NEW_TOKENS, \\{\\s*idToken: ${payload},\\s*dpopProof: [^;]*?createDpopHeader\\(url, method, [\\w.]*dpopKey, ath\\)[^;]*\\}\\);\\s*\\}\\s*catch`;
  it.each([
    ["authn-browser", "index.js", new RegExp(`Could not retrieve session[\\s\\S]{0,400}?${guardedEmit("tokens\\.idToken")}`)],
    ["authn-browser", "index.mjs", new RegExp(`Could not retrieve session[\\s\\S]{0,400}?${guardedEmit("tokens\\.idToken")}`)],
    ["authn-core", "index.js", new RegExp(guardedEmit("tokenSet\\.idToken"))],
    ["authn-core", "index.mjs", new RegExp(guardedEmit("tokenSet\\.idToken"))],
  ])("the %s build %s carries the patch", (pkg, file, patched) => {
    const source = readFileSync(`node_modules/@inrupt/solid-client-${pkg}/dist/${file}`, "utf8");
    expect(source).toMatch(patched);
  });

  it.each(["index.js", "index.mjs"])("the authn-core build %s lets proofs carry an ath claim", (file) => {
    const source = readFileSync(`node_modules/@inrupt/solid-client-authn-core/dist/${file}`, "utf8");
    expect(source).toMatch(
      /async function createDpopHeader\(audience, method, dpopKey, ath\) \{[\s\S]{0,200}?\.\.\.\(typeof ath === "string" \? \{ ath \} : \{\}\)/,
    );
  });
});
