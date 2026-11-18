/**
 * ESS 3 token exchange.
 *
 * ESS 3 storage rejects Solid-OIDC DPoP tokens with
 *   401 WWW-Authenticate: Bearer realm="<storage origin>", as_uri="<authorisation server>"
 * and only accepts a Bearer access token from that authorisation server,
 * obtained by exchanging the user's ID token (RFC 8693, no client
 * authentication). If the ID token is bound to a key (`cnf.jkt`), as Solid-OIDC
 * ID tokens obtained with DPoP are, the exchange also carries a DPoP proof
 * signed with that key (RFC 9449), whose `ath` is the hash of the ID token. Servers that never send that challenge, such as Community
 * Solid Server, are unaffected: their requests go through the DPoP fetch only.
 *
 * Security rules (see CLAUDE.md):
 * - the realm must be exactly the origin of the request that got the 401;
 * - the authorisation server must be on the allow list (deployment config, with
 *   ODI's platform trusted by default) and its metadata `issuer` must match as_uri;
 * - tokens live in memory only and never appear in errors or logs;
 * - Bearer requests carry no DPoP header and no cookies; only the exchange
 *   request carries a DPoP proof, and only after checking its key is the one
 *   the ID token is bound to.
 */

import type { IdToken } from "./idTokenStore";

const TOKEN_EXCHANGE = "urn:ietf:params:oauth:grant-type:token-exchange";
const ID_TOKEN_TYPE = "urn:ietf:params:oauth:token-type:id_token";
/** Exchange again when the platform token is this close to expiry. */
const RENEW_MARGIN_MS = 30_000;

/**
 * Authorisation servers trusted without configuration. Others are added per
 * deployment with NEXT_PUBLIC_ESS_AUTHORIZATION_SERVERS. Anyone holding a
 * user's ID token can exchange it for their ESS storage access, so it is only
 * ever sent to servers listed here or there.
 */
export const DEFAULT_TRUSTED_AUTHORIZATION_SERVERS = ["https://platform.odi.ess.solid-experiments.org"];

export interface EssChallenge {
  asUri: string;
  realm: string;
}

export interface EssFetchOptions {
  /** The Solid-OIDC (DPoP) fetch; used first, and for every non-ESS server. */
  solidFetch: typeof fetch;
  /** A plain, unauthenticated fetch for metadata, the exchange and Bearer requests. */
  plainFetch: typeof fetch;
  /** The current, unexpired ID token (with its DPoP proof signer), if any. */
  getIdToken: () => IdToken | undefined;
  /** Origins of the authorisation servers allowed to receive the ID token. */
  trustedAuthorizationServers: string[];
  /** Kill switch: when false, behave exactly like `solidFetch`. */
  enabled?: boolean;
  /**
   * Called when the session can no longer reach ESS storage: there is no valid
   * ID token to exchange, or a freshly exchanged token is still refused.
   * Ordinary 401s (e.g. a resource the user may not read) never trigger it.
   */
  onSignInRequired?: () => void;
  now?: () => number;
}

export class EssTokenExchangeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EssTokenExchangeError";
  }
}

/** Reads `as_uri` and `realm` from an ESS 401 challenge, or null if there is none. */
export function parseEssChallenge(response: Response): EssChallenge | null {
  if (response.status !== 401) return null;
  const header = response.headers.get("WWW-Authenticate") ?? "";
  const asUri = /as_uri="([^"]+)"/.exec(header)?.[1];
  const realm = /realm="([^"]+)"/.exec(header)?.[1];
  return asUri && realm ? { asUri, realm } : null;
}

const trimSlash = (url: string) => url.replace(/\/+$/, "");

/** True when the authorisation server is an HTTPS origin on the allow list. */
export function isTrustedAuthorizationServer(asUri: string, allowList: string[]): boolean {
  try {
    const as = new URL(asUri);
    return as.protocol === "https:" && allowList.some((origin) => trimSlash(origin) === as.origin);
  } catch {
    return false;
  }
}

const base64url = (bytes: ArrayBuffer) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

/** The JSON of one part (0 = header, 1 = payload) of a JWT, or undefined. */
function jwtPart(jwt: string, index: 0 | 1): Record<string, unknown> | undefined {
  try {
    const part = jwt.split(".")[index];
    const json = JSON.parse(atob(part.replace(/-/g, "+").replace(/_/g, "/")));
    return json && typeof json === "object" ? json : undefined;
  } catch {
    return undefined;
  }
}

/**
 * The `cnf.jkt` of a key-bound ID token, or undefined if it has no `cnf`.
 * Throws for a binding that can't be read, so the token is never sent
 * without the proof it needs.
 */
export function boundKeyThumbprint(idToken: string): string | undefined {
  const payload = jwtPart(idToken, 1);
  if (!payload) throw new EssTokenExchangeError("The ID token can't be read.");
  if (payload.cnf === undefined) return undefined;
  const jkt = (payload.cnf as { jkt?: unknown } | null)?.jkt;
  if (typeof jkt !== "string" || jkt === "") throw new EssTokenExchangeError("The ID token's key binding can't be read.");
  return jkt;
}

/** A response's JSON object, or null if the body isn't one (no parser text escapes). */
async function jsonObject(response: Response): Promise<Record<string, unknown> | null> {
  const body: unknown = await response.json().catch(() => null);
  return body !== null && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
}

/** base64url(SHA-256(value)): a DPoP `ath`, here of the token being exchanged. */
export async function tokenHash(value: string): Promise<string> {
  return base64url(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
}

/** The members RFC 7638 hashes for each key type, in lexicographic order. */
const THUMBPRINT_MEMBERS: Record<string, string[]> = {
  EC: ["crv", "kty", "x", "y"],
  OKP: ["crv", "kty", "x"],
  RSA: ["e", "kty", "n"],
};

/** The RFC 7638 SHA-256 thumbprint of the public key in a DPoP proof's header. */
export async function proofKeyThumbprint(proof: string): Promise<string | undefined> {
  const jwk = jwtPart(proof, 0)?.jwk as Record<string, unknown> | undefined;
  const members = typeof jwk?.kty === "string" ? THUMBPRINT_MEMBERS[jwk.kty] : undefined;
  if (!jwk || !members || members.some((name) => typeof jwk[name] !== "string")) return undefined;
  const canonical = JSON.stringify(Object.fromEntries(members.map((name) => [name, jwk[name]])));
  return base64url(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical)));
}

/** A body that can safely be sent twice (streams cannot). */
function isReplayable(input: RequestInfo | URL, init?: RequestInit): boolean {
  if (input instanceof Request && input.body !== null) return false;
  return !(init?.body instanceof ReadableStream);
}

/**
 * Wraps the Solid-OIDC fetch so ESS 3 storage works: DPoP first; on an ESS
 * challenge, exchange the ID token and retry with the platform's Bearer token.
 * Known ESS realms go straight to Bearer. Call `clear()` on logout.
 */
export function createEssAwareFetch(options: EssFetchOptions) {
  const { solidFetch, plainFetch, getIdToken, now = Date.now } = options;
  /** Only a new sign-in can fix this: no usable ID token, or no matching key. */
  const signInRequired = (message: string) => {
    options.onSignInRequired?.();
    return new EssTokenExchangeError(message);
  };
  const noIdToken = () => signInRequired("No valid ID token to exchange; please sign in again.");
  const trusted = options.trustedAuthorizationServers;
  const realms = new Map<string, { challenge: EssChallenge; token?: string; expiresAt: number }>();
  const pending = new Map<string, Promise<string>>();
  const endpoints = new Map<string, Promise<string>>();
  /** Bumped by clear(); work started before a logout must not outlive it. */
  let generation = 0;
  const assertCurrent = (startedIn: number) => {
    if (startedIn !== generation) throw new EssTokenExchangeError("Signed out during the request.");
  };

  function tokenEndpoint(asUri: string): Promise<string> {
    let endpoint = endpoints.get(asUri);
    if (!endpoint) {
      endpoint = (async () => {
        // No redirects: a redirect could send us (and later the ID token) elsewhere.
        const response = await plainFetch(`${trimSlash(asUri)}/.well-known/oauth-authorization-server`, {
          redirect: "error",
        });
        if (!response.ok) throw new EssTokenExchangeError(`Authorisation server metadata unavailable (${response.status}).`);
        const metadata = ((await jsonObject(response)) ?? {}) as { issuer?: string; token_endpoint?: string };
        if (trimSlash(metadata.issuer ?? "") !== trimSlash(asUri)) {
          throw new EssTokenExchangeError("Authorisation server metadata does not match the challenge.");
        }
        const tokenUrl = metadata.token_endpoint;
        if (typeof tokenUrl !== "string" || !URL.canParse(tokenUrl) || new URL(tokenUrl).origin !== new URL(asUri).origin) {
          throw new EssTokenExchangeError("Authorisation server token endpoint is missing or on another origin.");
        }
        return tokenUrl;
      })();
      endpoint.catch(() => endpoints.delete(asUri));
      endpoints.set(asUri, endpoint);
    }
    return endpoint;
  }

  async function exchange(challenge: EssChallenge, startedIn: number): Promise<string> {
    const endpoint = await tokenEndpoint(challenge.asUri);
    // Read the ID token only now, and only if no logout happened meanwhile.
    assertCurrent(startedIn);
    const idToken = getIdToken();
    if (!idToken) throw noIdToken();
    const headers = new Headers();
    // A key-bound ID token is only accepted with a proof from the same key.
    const jkt = boundKeyThumbprint(idToken.token);
    if (jkt) {
      if (!idToken.dpopProof) throw signInRequired("No key to prove the ID token with; please sign in again.");
      // ESS requires `ath`, the hash of the subject token, in the proof.
      const proof = await idToken.dpopProof(endpoint, "POST", await tokenHash(idToken.token));
      if ((await proofKeyThumbprint(proof)) !== jkt) {
        throw signInRequired("The DPoP key doesn't match the ID token; please sign in again.");
      }
      assertCurrent(startedIn);
      headers.set("DPoP", proof);
    }
    const response = await plainFetch(endpoint, {
      method: "POST",
      headers,
      // A 307/308 would re-send the body, ID token included, to wherever it points.
      redirect: "error",
      body: new URLSearchParams({
        grant_type: TOKEN_EXCHANGE,
        subject_token: idToken.token,
        subject_token_type: ID_TOKEN_TYPE,
        resource: challenge.realm,
      }),
    });
    if (!response.ok) {
      const error = (await jsonObject(response))?.error;
      // Only a plain OAuth error code: a server-chosen string could echo the token.
      const code = typeof error === "string" && /^[a-z_]{1,64}$/.test(error) ? ` ${error}` : "";
      throw new EssTokenExchangeError(`Token exchange failed (${response.status}${code}).`);
    }
    const { access_token, expires_in } = ((await jsonObject(response)) ?? {}) as { access_token?: unknown; expires_in?: unknown };
    if (typeof access_token !== "string" || !access_token) throw new EssTokenExchangeError("Token exchange returned no access token.");
    const lifetime = typeof expires_in === "number" && expires_in > 0 ? expires_in : 60;
    assertCurrent(startedIn);
    realms.set(challenge.realm, { challenge, token: access_token, expiresAt: now() + lifetime * 1000 });
    return access_token;
  }

  /** A valid platform token for the realm, exchanging (once, shared) when needed. */
  function platformToken(challenge: EssChallenge, startedIn: number, forceNew = false): Promise<string> {
    const cached = realms.get(challenge.realm);
    if (!forceNew && cached?.token && cached.expiresAt - RENEW_MARGIN_MS > now()) {
      return Promise.resolve(cached.token);
    }
    let inFlight = pending.get(challenge.realm);
    if (!inFlight) {
      inFlight = exchange(challenge, startedIn).finally(() => pending.delete(challenge.realm));
      pending.set(challenge.realm, inFlight);
    }
    return inFlight;
  }

  function bearerFetch(input: RequestInfo | URL, init: RequestInit | undefined, token: string) {
    const headers = new Headers(input instanceof Request ? input.headers : undefined);
    new Headers(init?.headers).forEach((value, key) => headers.set(key, value));
    headers.delete("DPoP");
    headers.set("Authorization", `Bearer ${token}`);
    return plainFetch(input, { ...init, headers, credentials: "omit" });
  }

  /** Sends with the realm's Bearer token; on a 401, exchanges once more and retries once. */
  async function viaEss(challenge: EssChallenge, startedIn: number, input: RequestInfo | URL, init?: RequestInit) {
    assertCurrent(startedIn);
    const replayable = isReplayable(input, init);
    const token = await platformToken(challenge, startedIn);
    assertCurrent(startedIn);
    const first = await bearerFetch(input, init, token);
    if (first.status !== 401 || !replayable) return first;
    const fresh = await platformToken(challenge, startedIn, true);
    assertCurrent(startedIn);
    const second = await bearerFetch(input, init, fresh);
    // Only if this is still the same session: a late 401 must not sign out a newer one.
    if (second.status === 401 && startedIn === generation) options.onSignInRequired?.();
    return second;
  }

  const essAwareFetch: typeof fetch = async (input, init) => {
    if (options.enabled === false) return solidFetch(input, init);
    const startedIn = generation;

    const url = new URL(input instanceof Request ? input.url : input.toString(), globalThis.location?.href);
    // Send the resolved URL: identical for the browser, unambiguous for us.
    const target = input instanceof Request ? input : url.href;
    const known = realms.get(url.origin);
    if (known) return viaEss(known.challenge, startedIn, target, init);

    const replayable = isReplayable(target, init);
    const retryInput = replayable && target instanceof Request ? target.clone() : target;
    const response = await solidFetch(target, init);
    const challenge = parseEssChallenge(response);
    if (!challenge || !replayable) return response;
    // A logout or account switch while the first request was out must not
    // lead to an exchange with whoever is signed in now.
    assertCurrent(startedIn);

    // Trust first: an untrusted challenge is ignored whatever the token state,
    // so it can never sign the user out. The 401 must come from the server
    // asked, not from where a redirect led.
    const answeredBy = response.url ? new URL(response.url).origin : url.origin;
    const trustworthy =
      challenge.realm === url.origin && answeredBy === url.origin && isTrustedAuthorizationServer(challenge.asUri, trusted);
    if (!trustworthy) {
      console.warn("Ignoring an ESS token challenge from an untrusted authorisation server or realm.");
      return response;
    }
    if (!getIdToken()) throw noIdToken();
    realms.set(challenge.realm, { challenge, expiresAt: 0 });
    return viaEss(challenge, startedIn, retryInput, init);
  };

  return {
    fetch: essAwareFetch,
    /** Forget every platform token (call on logout). */
    clear(): void {
      generation += 1;
      realms.clear();
      pending.clear();
    },
  };
}
