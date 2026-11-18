/**
 * The servers that get the user's login: the origin of their WebID and of each
 * of their storages. Everything else (contacts' profiles, WebIDs typed into
 * the share dialog, access documents a server points to elsewhere) is fetched
 * without it. An ESS server can still be reached: its 401 challenge goes
 * through the token exchange, which checks that server itself.
 */
export interface OwnServers {
  /**
   * Registers a storage of `webId`'s, whose origin may then get their login.
   * Returns a release function that undoes exactly this registration (and
   * does nothing after `clear`, so a stale one can't undo a later one).
   */
  add(url: string, webId: string): () => void;
  /** Whether `url` is on `webId`'s origin or one of the storages registered for that WebID. */
  includes(url: string, webId: string | undefined): boolean;
  clear(): void;
}

function originOf(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

export function createOwnServers(): OwnServers {
  // One entry per registration, so releasing one storage keeps another on the
  // same origin; keyed by WebID, so a late registration for an earlier
  // account never counts for the next one.
  const registrations = new Set<{ origin: string; webId: string }>();
  return {
    add(url, webId) {
      const origin = originOf(url);
      if (!origin || origin === "null") return () => {};
      const registration = { origin, webId };
      registrations.add(registration);
      return () => registrations.delete(registration);
    },
    includes(url, webId) {
      const origin = originOf(url);
      if (!origin || origin === "null" || !webId) return false;
      if (origin === originOf(webId)) return true;
      return [...registrations].some((r) => r.webId === webId && r.origin === origin);
    },
    clear() {
      registrations.clear();
    },
  };
}

/** The URL a fetch call is for. */
export function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return input.url;
}
