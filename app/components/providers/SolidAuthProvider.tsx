"use client";

import {
    createContext,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    useSyncExternalStore,
    type ReactNode,
} from "react";
import type { AuthorizationCodeFlow } from "@solid/reactive-authentication";
import { ensureElementsRegistered } from "@/app/lib/auth/elements";
import {
    getCurrentSession,
    initAuthManager,
    resetAuthManager,
    setCurrentSession,
    subscribeToSession,
    type SolidCredentials,
} from "@/app/lib/auth/manager";

const STORAGE_KEY = "solid-file-manager-session";

export type SolidAuthStatus = "restoring" | "anonymous" | "authenticated";

export interface SolidAuthContextValue {
    session: {
        isLoggedIn: boolean;
        webId: string | null;
        issuer: string | null;
    };
    status: SolidAuthStatus;
    // The issuer of the session just ended, so the login page can offer to sign
    // out there too. In memory only: the offer is stale after a reload.
    signedOutFrom: string | null;
    
    login: (credentials: { webId: string; issuer: string }) => void;
    logout: () => Promise<void>;
}

export const SolidAuthContext = createContext<SolidAuthContextValue | null>(null);

export default function SolidAuthProvider({ children }: { children: ReactNode }) {
    const codeUiRef = useRef<AuthorizationCodeFlow | null>(null);
    const generationRef = useRef(0);

    const credentials = useSyncExternalStore(
        subscribeToSession,
        getCurrentSession,
        () => null,
    );
    const [status, setStatus] = useState<SolidAuthStatus>("restoring");
    const [signedOutFrom, setSignedOutFrom] = useState<string | null>(null);

    const buildManager = useCallback(
        () =>
            initAuthManager({
                callbackUri: `${window.location.origin}/callback.html`,
                // Read the method lazily: the custom element may not have upgraded yet.
                getCode: (authorizationUri, signal) => {
                    const ui = codeUiRef.current;
                    if (!ui) throw new Error("authorization-code-flow is not mounted");
                    return ui.getCode(authorizationUri, signal);
                },
            }),
        [],
    );

    useEffect(() => {
        const generation = ++generationRef.current;

        async function restore() {
            await ensureElementsRegistered();
            await buildManager();
            if (generationRef.current !== generation) return;

            // Only the identity is persisted. Tokens live in the token provider
            // and die with the page, so the next protected request re-runs the
            // flow, silently while the issuer's cookie lasts.
            const stored = readStoredCredentials();
            if (stored) setCurrentSession(stored);
            setStatus(stored ? "authenticated" : "anonymous");
        }

        restore();
    }, [buildManager]);

    const login = useCallback((next: { webId: string; issuer: string }) => {
        generationRef.current++;
        setCurrentSession(next);
        writeStoredCredentials(next);
        setSignedOutFrom(null);
        setStatus("authenticated");
    }, []);

    const logout = useCallback(async () => {
        const generation = ++generationRef.current;
        const previousIssuer = getCurrentSession()?.issuer ?? null;

        clearStoredCredentials();
        setStatus("restoring");

        resetAuthManager();
        await buildManager();
        if (generationRef.current !== generation) return;
        setSignedOutFrom(previousIssuer);
        setStatus("anonymous");
    }, [buildManager]);

    const value = useMemo<SolidAuthContextValue>(
        () => ({
            session: {
                isLoggedIn: status === "authenticated",
                webId: credentials?.webId ?? null,
                issuer: credentials?.issuer ?? null,
            },
            status,
            signedOutFrom,
            login,
            logout,
        }),
        [credentials, status, signedOutFrom, login, logout],
    );

    return (
        <SolidAuthContext.Provider value={value}>
            {children}
            {/* Hosts the login popup and its blocked-popup dialogs. */}
            <authorization-code-flow ref={codeUiRef} />
        </SolidAuthContext.Provider>
    );
}

function isCredentials(value: unknown): value is SolidCredentials {
    return (
        typeof value === "object" &&
        value !== null &&
        typeof (value as SolidCredentials).webId === "string" &&
        typeof (value as SolidCredentials).issuer === "string"
    );
}

function readStoredCredentials(): SolidCredentials | null {
    try {
        const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
        return isCredentials(parsed) ? parsed : null;
    } catch (error) {
        console.warn("Discarding an unreadable stored session", error);
        return null;
    }
}

function writeStoredCredentials(credentials: SolidCredentials): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(credentials));
    } catch (error) {
        // The session still works; it just won't survive a reload.
        console.warn("Could not persist the session", error);
    }
}

function clearStoredCredentials(): void {
    try {
        localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
        // The identity stays on disk until something else clears it.
        console.warn("Could not clear the stored session", error);
    }
}
