import { getDefaultSession, Session } from "@inrupt/solid-client-authn-browser";

/**
 * Gets the current Solid session and optionally validates authentication.
 * 
 * @param requireAuth - If true, throws an error if the user is not authenticated. Defaults to true.
 * @returns An object containing the session and authenticated fetch function.
 * @throws Error if requireAuth is true and the user is not authenticated.
 */
export function getAuthenticatedSession(requireAuth: boolean = true): {
  session: Session;
  fetch: typeof fetch;
} {
  const session = getDefaultSession();
  
  if (requireAuth && !session.info.isLoggedIn) {
    throw new Error("Not authenticated");
  }
  
  return {
    session,
    fetch: session.fetch || fetch,
  };
}

/**
 * Gets the current Solid session without requiring authentication.
 * Useful for checking session state without throwing errors.
 * 
 * @returns The current session.
 */
export function getSession(): Session {
  return getDefaultSession();
}

