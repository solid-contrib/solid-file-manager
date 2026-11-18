import type { Session } from "@inrupt/solid-client-authn-browser";
import { requestUrl } from "./ownServers";

type SessionLike = Pick<Session, "info" | "fetch">;

/** Limits which servers get the user's login (see ownServers.ts). */
export interface LoginScope {
  isOwn(url: string, webId: string | undefined): boolean;
  /** Used, without the login, for every other server. */
  plainFetch: typeof fetch;
}

/**
 * The app's single authenticated fetch.
 *
 * It looks the session up on every call, so it stays valid across login,
 * logout and token refresh. It rejects instead of silently sending an
 * unauthenticated request when nobody is logged in.
 *
 * With a `scope`, only the user's own servers get the login; requests to any
 * other server go out without it.
 *
 * This is the seam where server-specific behaviour (e.g. ESS token exchange)
 * plugs in; the rest of the app only ever sees `typeof fetch`.
 */
export function createSolidFetch(getSession: () => SessionLike, scope?: LoginScope): typeof fetch {
  return (input, init) => {
    const session = getSession();
    if (!session.info.isLoggedIn) {
      return Promise.reject(new Error("Not authenticated"));
    }
    if (scope && !scope.isOwn(requestUrl(input), session.info.webId)) {
      return scope.plainFetch(input, init);
    }
    return session.fetch(input, init);
  };
}
