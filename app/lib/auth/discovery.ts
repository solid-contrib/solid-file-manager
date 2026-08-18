export interface DiscoveryDocument {
  issuer: string;
  end_session_endpoint?: string;
  userinfo_endpoint?: string;
}

const TIMEOUT_MS = 8000;

// Holds the in-flight request, not just the result, so concurrent callers share
// one round trip instead of each firing their own.
const cache = new Map<string, Promise<DiscoveryDocument | null>>();

/**
 * Reads an authorization server's OIDC metadata. Returns null when the URL is
 * not an issuer, the login page uses it to tell an issuer apart from a WebID.
 */
export function fetchDiscovery(issuer: string): Promise<DiscoveryDocument | null> {
  const url = discoveryUrl(issuer);
  if (!url) return Promise.resolve(null);

  let pending = cache.get(url);
  if (!pending) {
    pending = read(url);
    cache.set(url, pending);

    void pending.then(
      (document) => {
        if (!document) cache.delete(url);
      },
      () => cache.delete(url),
    );
  }

  return pending;
}

async function read(url: string): Promise<DiscoveryDocument | null> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!response.ok) return null;

    const document: unknown = await response.json();
    return isDiscoveryDocument(document) ? document : null;
  } catch {
    return null;
  }
}

function discoveryUrl(issuer: string): string | null {
  try {
    const url = new URL(issuer);
    url.pathname = `${url.pathname.replace(/\/$/, "")}/.well-known/openid-configuration`;
    url.search = "";
    url.hash = "";
    return url.href;
  } catch {
    return null;
  }
}

function isDiscoveryDocument(value: unknown): value is DiscoveryDocument {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as DiscoveryDocument).issuer === "string"
  );
}
