"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Image from "next/image";
import { identify } from "../lib/auth/identify";
import { fetchDiscovery } from "../lib/auth/discovery";
import {
    allowOrigin,
    getAuthenticatedWebId,
    getAuthFetch,
    setCurrentSession,
} from "../lib/auth/manager";
import {
    getLastLoginEntry,
    saveLastLoginEntry,
} from "../lib/helpers/loginHistoryUtils";
import { useSolidAuth } from "../lib/hooks/useSolidAuth";
import IssuerPickerDialog from "./IssuerPickerDialog";
import SignedOutNotice from "./SignedOutNotice";
import Button from "./shared/Button";
import GitHubLinks from "./shared/GitHubLinks";
import UrlCombobox, { type ComboboxOption } from "./shared/UrlCombobox";

// Suggestions only — anything the user types is accepted, so this list is here
// for convenience and can grow or go without affecting the flow.
const KNOWN_ISSUERS: ComboboxOption[] = [
    { label: "Inrupt PodSpaces", value: "https://login.inrupt.com" },
    { label: "solidcommunity.net", value: "https://solidcommunity.net" },
];

const LABELS = {
    either: "WebID (or OIDC issuer)",
    issuer: "Your login server",
    webid: "Your WebID",
} as const;

const HELPER_TEXT = {
    either: "For example https://id.inrupt.com/you",
    issuer: "That WebID does not name a login server, so please enter one.",
    webid: "We have your login server. Now enter the WebID it signs you in as.",
} as const;

export default function LoginPage() {
    const { login, signedOutFrom } = useSolidAuth();

    const [entry, setEntry] = useState("");
    const [remembered, setRemembered] = useState("");
    const [webId, setWebId] = useState<string | null>(null);
    const [issuer, setIssuer] = useState<string | null>(null);
    const [choices, setChoices] = useState<string[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [isResolving, setIsResolving] = useState(false);

    useEffect(() => {
        const last = getLastLoginEntry();
        setEntry(last);
        setRemembered(last);
    }, []);

    const options = useMemo<ComboboxOption[]>(() => {
        if (!remembered) return KNOWN_ISSUERS;
        return [
            { label: remembered, value: remembered, secondaryLabel: "Last used" },
            // The remembered entry is often one of the suggestions already.
            ...KNOWN_ISSUERS.filter((option) => option.value !== remembered),
        ];
    }, [remembered]);

    const needs = webId && !issuer ? "issuer" : issuer && !webId ? "webid" : "either";

    /**
     * Nothing authenticates until a request to a vouched origin comes back 401,
     * and which URL does that differs by server: a protected profile or pod root
     * on CSS, the userinfo endpoint on ESS. Try each until a flow has run.
     */
    async function authenticate(candidateWebId: string | null, candidateIssuer: string) {
        const discovery = await fetchDiscovery(candidateIssuer);
        const probes = [candidateWebId, discovery?.userinfo_endpoint, candidateIssuer];

        for (const probe of probes) {
            if (!probe) continue;
            if (await getAuthenticatedWebId(candidateIssuer)) return;

            try {
                await getAuthFetch()(probe);
            } catch (error) {
                console.warn(`Could not sign in via ${probe}`, error);
            }
        }
    }

    async function finish(nextWebId: string | null, nextIssuer: string | null) {
        setWebId(nextWebId);
        setIssuer(nextIssuer);

        if (!nextIssuer) {
            // Nowhere to sign in to yet; the field relabels and asks for one.
            setCurrentSession(null);
            setEntry("");
            return;
        }

        // Sign in here, while the submitting click is still the active gesture, so
        // the popup is not blocked and the session is cached before the file
        // manager mounts and fires a dozen requests.
        setCurrentSession({ webId: nextWebId, issuer: nextIssuer });
        allowOrigin(nextIssuer);
        await authenticate(nextWebId, nextIssuer);

        // Solid-OIDC puts the WebID in the id_token, so an issuer on its own is
        // enough: sign in first, then ask who that turned out to be.
        const confirmedWebId = nextWebId ?? (await getAuthenticatedWebId(nextIssuer));

        if (!confirmedWebId) {
            setCurrentSession(null);
            setEntry("");
            setError("That login server did not say who you are. Please enter your WebID.");
            return;
        }

        setWebId(confirmedWebId);
        saveLastLoginEntry(confirmedWebId);
        login({ webId: confirmedWebId, issuer: nextIssuer });
    }

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const value = entry.trim();
        if (!value) return;

        setError(null);
        setIsResolving(true);
        try {
            const target = await identify(value);

            if (target.kind === "unknown") {
                setError("That is not a WebID or a login server we could reach.");
                return;
            }

            if (target.kind === "issuer") {
                await finish(webId, target.issuer);
                return;
            }

            if (target.issuers.length > 1) {
                setWebId(target.webId);
                setChoices(target.issuers);
                return;
            }

            await finish(target.webId, target.issuers[0] ?? issuer);
        } finally {
            setIsResolving(false);
        }
    }

    return (
        <main className="flex min-h-screen flex-col items-center justify-center bg-white px-4">
            <section className="w-full max-w-sm">
                <div className="mb-8 flex flex-col items-center text-center">
                    <Image
                        src="/file-manager-logo.svg"
                        alt=""
                        width={48}
                        height={48}
                        priority
                    />
                    <h1 className="mt-4 text-2xl font-medium text-black">Sign in</h1>
                    <p className="mt-1 text-sm text-gray-600">
                        to continue to Solid File Manager
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <UrlCombobox
                            label={LABELS[needs]}
                            value={entry}
                            onChange={setEntry}
                            options={options}
                            error={error ?? undefined}
                            disabled={isResolving}
                            aria-describedby="login-entry-help"
                        />
                        {/* A live region: the label and this text change when we
                            learn half the credentials and ask for the other. */}
                        <p
                            id="login-entry-help"
                            role="status"
                            className="mt-1 text-xs text-gray-600"
                        >
                            {error ? "" : HELPER_TEXT[needs]}
                        </p>
                    </div>

                    <Button
                        type="submit"
                        variant="primary"
                        size="lg"
                        className="w-full"
                        isLoading={isResolving}
                        disabled={!entry.trim()}
                    >
                        Continue
                    </Button>
                </form>

                {signedOutFrom && <SignedOutNotice issuer={signedOutFrom} />}

                <div className="mt-10 flex justify-center">
                    <GitHubLinks layout="horizontal" />
                </div>
            </section>

            <IssuerPickerDialog
                isOpen={choices.length > 0}
                issuers={choices}
                onSelect={(choice) => {
                    setChoices([]);
                    setIsResolving(true);
                    void finish(webId, choice).finally(() => setIsResolving(false));
                }}
                onClose={() => setChoices([])}
            />
        </main>
    );
}
