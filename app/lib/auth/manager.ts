import type { GetCodeCallback, TokenProvider } from "@solid/reactive-authentication";

export interface SolidCredentials {
  // Null only while an issuer-first sign-in is asking userinfo who the user is.
  webId: string | null;
  issuer: string;
}

export interface AuthManagerOptions {
  callbackUri: string;
  getCode: GetCodeCallback;
}

let authFetch: typeof globalThis.fetch | null = null;
let initialization: Promise<typeof globalThis.fetch> | null = null;
let sessionWebId: ((issuer: string) => Promise<string | undefined>) | null = null;

// Who we are currently authenticating as. Held here rather than in React so
// that plain modules — the session facade, the profile and contact helpers —
// read the same value the UI renders.
let currentSession: SolidCredentials | null = null;
const sessionListeners = new Set<() => void>();

// DPoPTokenProvider.matches() accepts every 401, from any host. This app fetches
// URLs it does not control (previews, shared resources, foreign WebIDs) so
// credentials go only to origins named here.
const allowedOrigins = new Set<string>();

export const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

export function allowOrigin(url: string): void {
  let origin: string;
  try {
    origin = new URL(url).origin;
  } catch {
    throw new Error(`allowOrigin() needs an absolute URL, received "${url}"`);
  }
  allowedOrigins.add(origin);
}

function isAllowed(url: string): boolean {
  try {
    return allowedOrigins.has(new URL(url).origin);
  } catch {
    return false;
  }
}

function originGated(inner: TokenProvider): TokenProvider {
  return {
    async matches(request) {
      return isAllowed(request.url) && inner.matches(request);
    },
    upgrade: (request) => inner.upgrade(request),
  };
}

export function getCurrentSession(): SolidCredentials | null {
  return currentSession;
}

export function setCurrentSession(next: SolidCredentials | null): void {
  currentSession = next;
  // Reading the profile is the first thing anything does with an identity.
  if (next?.webId) allowOrigin(next.webId);
  for (const listener of sessionListeners) listener();
}

export function subscribeToSession(listener: () => void): () => void {
  sessionListeners.add(listener);
  return () => {
    sessionListeners.delete(listener);
  };
}

export function initAuthManager(
  options: AuthManagerOptions,
): Promise<typeof globalThis.fetch> {
  if (typeof window === "undefined") {
    throw new Error(
      "initAuthManager() must run in the browser: the package defines custom elements as soon as it loads.",
    );
  }

  initialization ??= createFetch(options);
  return initialization;
}

async function createFetch(options: AuthManagerOptions) {
  // Kept out of the top-level imports because the package declares classes extending
  // HTMLElement at import time, which throws during server rendering.
  const { DPoPTokenProvider, InsecureConfiguration, ReactiveFetchManager } =
    await import("@solid/reactive-authentication");

  let insecureAllowed = false;

  const tokenProvider = new DPoPTokenProvider(
    options.callbackUri,
    options.getCode,
    async () => {
      const session = getCurrentSession();
      if (!session) throw new Error("No issuer known: sign in first");

      const issuer = new URL(session.issuer);

      // oauth4webapi refuses http:// issuers outright, which puts a local
      // Community Solid Server out of reach. Its opt-out is a global switch, so
      // it is flipped only for a loopback host and only once: a remote issuer
      // must never be able to drop to plain HTTP.
      if (
        !insecureAllowed &&
        issuer.protocol === "http:" &&
        LOOPBACK_HOSTS.has(issuer.hostname)
      ) {
        InsecureConfiguration.allow();
        insecureAllowed = true;
      }

      return issuer;
    },
  );

  const provider = originGated(tokenProvider);
  const manager = new ReactiveFetchManager([provider]);

  sessionWebId = (issuer) => tokenProvider.webId(new URL(issuer));

  // Both read once and return a function, so we can bind them once and keep
  // the result around.
  const reactiveFetch = manager.fetch;
  const plainFetch = globalThis.fetch.bind(globalThis);

  authFetch = async (input, init) => {
    const request = new Request(input, init);

    if (getCurrentSession() && isAllowed(request.url)) {
      try {
        return await plainFetch(await provider.upgrade(request.clone()));
      } catch (error) {
        reportUpgradeFailure(request.url, error);
        return plainFetch(request);
      }
    }

    return reactiveFetch(request);
  };

  return authFetch;
}

const reportedFailures = new Set<string>();

// A failed upgrade means the request goes out unauthenticated and will almost
// certainly come back 401, which reads as a permissions problem rather than the
// configuration error it usually is. Report each distinct reason once: these
// repeat per request, and a hundred identical lines hide the one that matters.
function reportUpgradeFailure(url: string, error: unknown): void {
  const reason = error instanceof Error ? error.message : String(error);
  if (reportedFailures.has(reason)) return;

  reportedFailures.add(reason);
  console.error(`Sending ${url} without credentials: ${reason}`, error);
}

/**
 * The WebID the issuer asserted in its id_token, once a flow has completed for
 * it. Null before that, and asking never starts one — so signing in with only an
 * issuer means authenticating first, then asking who that turned out to be.
 */
export async function getAuthenticatedWebId(issuer: string): Promise<string | null> {
  if (sessionWebId === null) return null;

  try {
    return (await sessionWebId(issuer)) ?? null;
  } catch {
    return null;
  }
}

export function getAuthFetch(): typeof globalThis.fetch {
  if (authFetch === null) {
    throw new Error(
      "getAuthFetch() called before initAuthManager() resolved. Render behind the auth provider.",
    );
  }
  return authFetch;
}

// The library keeps its session in a private field on the provider with no way
// to clear it, so logging out means dropping the provider.
// TODO: replace with the provider's own teardown if the library grows one.
export function resetAuthManager(): void {
  authFetch = null;
  initialization = null;
  sessionWebId = null;
  allowedOrigins.clear();
  reportedFailures.clear();
  setCurrentSession(null);
}
