"use client";

import { createContext, useContext, useEffect, useMemo } from "react";
import { EVENTS, getDefaultSession } from "@inrupt/solid-client-authn-browser";
import { createSolidFetch } from "@/app/lib/helpers/solidFetch";
import { createOwnServers, type OwnServers } from "@/app/lib/helpers/ownServers";
import { createIdTokenStore, type DpopProofSigner } from "@/app/lib/helpers/idTokenStore";
import { createEssAwareFetch, DEFAULT_TRUSTED_AUTHORIZATION_SERVERS } from "@/app/lib/helpers/essTokenExchange";
import { createSignInAgain } from "@/app/lib/helpers/signInAgain";

/** Sign out and back to /login (created on first use: this module also renders on the server). */
let signInAgain: (() => Promise<void>) | undefined;
function requireSignIn(): void {
  signInAgain ??= createSignInAgain({
    logout: () => getDefaultSession().logout(),
    navigate: (url) => window.location.assign(url),
    currentPath: () => window.location.pathname + window.location.search,
    storage: (() => {
      try {
        return window.sessionStorage;
      } catch {
        return undefined;
      }
    })(),
  });
  void signInAgain();
}

const SolidFetchContext = createContext<typeof fetch | null>(null);
const OwnServersContext = createContext<Pick<OwnServers, "add"> | null>(null);

/**
 * Provides the app's single authenticated fetch. This is the only place that
 * reads the Inrupt session for fetching (LDO's login uses the same session).
 *
 * It also keeps the latest ID token, and the session's DPoP proof signer, in
 * memory, from the session's `newTokens` event (see patches/), and exchanges
 * the ID token for ESS 3 storage tokens when a server asks for that (see
 * essTokenExchange.ts). Other servers are unaffected.
 *
 * The login only goes to the user's own servers: their WebID's and their
 * storages' origins (registered through useOwnServers). Requests to any other
 * server are sent without it (see ownServers.ts).
 *
 * Build-time settings:
 * - NEXT_PUBLIC_ESS_TOKEN_EXCHANGE=off switches token exchange off.
 * - NEXT_PUBLIC_ESS_AUTHORIZATION_SERVERS: comma-separated origins of extra ESS
 *   authorisation servers to trust with the ID token (ODI's is trusted by default).
 */
export default function SolidFetchProvider({ children }: { children: React.ReactNode }) {
  const idTokens = useMemo(() => createIdTokenStore(), []);
  const ownServers = useMemo(() => createOwnServers(), []);
  const ess = useMemo(
    () =>
      createEssAwareFetch({
        solidFetch: createSolidFetch(getDefaultSession, {
          isOwn: (url, webId) => ownServers.includes(url, webId),
          plainFetch: (input, init) => fetch(input, { ...init, credentials: "omit" }),
        }),
        plainFetch: (input, init) => fetch(input, init),
        getIdToken: () => idTokens.get(),
        enabled: process.env.NEXT_PUBLIC_ESS_TOKEN_EXCHANGE !== "off",
        onSignInRequired: requireSignIn,
        trustedAuthorizationServers: [
          ...DEFAULT_TRUSTED_AUTHORIZATION_SERVERS,
          ...(process.env.NEXT_PUBLIC_ESS_AUTHORIZATION_SERVERS ?? "")
            .split(",")
            .map((origin) => origin.trim())
            .filter(Boolean),
        ],
      }),
    [idTokens, ownServers],
  );

  useEffect(() => {
    // Child effects run before LDO's provider handles the login redirect, and
    // the token arrives only after network calls, so no event is missed.
    const { events } = getDefaultSession();
    const onNewTokens = ({ idToken, dpopProof }: { idToken?: string; dpopProof?: DpopProofSigner }) =>
      idTokens.set(idToken, dpopProof);
    const onEnd = () => {
      idTokens.clear();
      ess.clear();
      ownServers.clear();
    };
    events.on(EVENTS.NEW_TOKENS, onNewTokens);
    events.on(EVENTS.LOGOUT, onEnd);
    events.on(EVENTS.SESSION_EXPIRED, onEnd);
    return () => {
      events.off(EVENTS.NEW_TOKENS, onNewTokens);
      events.off(EVENTS.LOGOUT, onEnd);
      events.off(EVENTS.SESSION_EXPIRED, onEnd);
      onEnd();
    };
  }, [idTokens, ess, ownServers]);

  return (
    <SolidFetchContext.Provider value={ess.fetch}>
      <OwnServersContext.Provider value={ownServers}>{children}</OwnServersContext.Provider>
    </SolidFetchContext.Provider>
  );
}

/** Registers the user's storages, whose servers may then get their login. */
export function useOwnServers(): Pick<OwnServers, "add"> {
  const ownServers = useContext(OwnServersContext);
  if (!ownServers) {
    throw new Error("useOwnServers must be used inside SolidFetchProvider");
  }
  return ownServers;
}

/** The authenticated fetch for talking to Solid servers. */
export function useSolidFetch(): typeof fetch {
  const solidFetch = useContext(SolidFetchContext);
  if (!solidFetch) {
    throw new Error("useSolidFetch must be used inside SolidFetchProvider");
  }
  return solidFetch;
}
