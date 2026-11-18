/** Treat a token this close to expiry as already expired. */
const EXPIRY_MARGIN_MS = 30_000;

/**
 * Signs a DPoP proof for a request with the session's DPoP key, optionally
 * with an `ath` claim (ESS's token exchange wants the subject token's hash).
 */
export type DpopProofSigner = (url: string, method: string, ath?: string) => Promise<string>;

export interface IdToken {
  token: string;
  /**
   * Signs proofs with the key the ID token is bound to (its `cnf.jkt`), if the
   * session has one. The key itself is never exposed.
   */
  dpopProof?: DpopProofSigner;
}

/**
 * Holds the latest Solid-OIDC ID token, and the session's DPoP proof signer,
 * in memory only (never in storage or logs). They are kept up to date from the
 * Inrupt session's `newTokens` event, which our patch to
 * @inrupt/solid-client-authn-* emits after login, silent restore and every
 * refresh (see patches/).
 *
 * ESS 3 storage only accepts tokens obtained by exchanging this ID token; a
 * key-bound ID token must be exchanged with a DPoP proof from the same key.
 */
export function createIdTokenStore(now: () => number = Date.now) {
  let current: IdToken | undefined;

  return {
    /**
     * Keeps a new ID token and its signer. A refresh may return no ID token
     * (OIDC allows that); the current one is then kept, as it may still be
     * valid. Only clear() forgets it.
     */
    set(token: string | undefined, dpopProof?: DpopProofSigner): void {
      if (token !== undefined) current = { token, dpopProof };
    },
    clear(): void {
      current = undefined;
    },
    /** The ID token if it is still valid, otherwise undefined (and forgotten). */
    get(): IdToken | undefined {
      const expiresAt = current === undefined ? undefined : readExpiry(current.token);
      if (expiresAt === undefined || expiresAt - EXPIRY_MARGIN_MS <= now()) {
        current = undefined;
        return undefined;
      }
      return current;
    },
  };
}

export type IdTokenStore = ReturnType<typeof createIdTokenStore>;

/** The `exp` claim of a JWT in milliseconds, or undefined if it cannot be read. */
function readExpiry(jwt: string): number | undefined {
  try {
    const payload = jwt.split(".")[1];
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    const { exp } = JSON.parse(json) as { exp?: unknown };
    return typeof exp === "number" ? exp * 1000 : undefined;
  } catch {
    return undefined;
  }
}
