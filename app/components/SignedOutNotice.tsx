"use client";

import { useEffect, useState } from "react";
import { fetchDiscovery } from "../lib/auth/discovery";

interface SignedOutNoticeProps {
    issuer: string;
}

/**
 * Signing out clears this app's session, but not the cookie at the login server
 * that would sign the next person straight back in. We cannot end that session
 * for them: the token provider discards the id_token, so there is no
 * id_token_hint to send and no registered post-logout redirect to return from.
 * So this offers the door rather than walking them through it.
 */
export default function SignedOutNotice({ issuer }: SignedOutNoticeProps) {
    const [endSessionUrl, setEndSessionUrl] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        fetchDiscovery(issuer).then((document) => {
            if (!cancelled) setEndSessionUrl(document?.end_session_endpoint ?? null);
        });
        return () => {
            cancelled = true;
        };
    }, [issuer]);

    return (
        <p role="status" className="mt-6 text-center text-xs text-gray-500">
            Signed out. You may still be signed in at{" "}
            <span className="font-medium">{hostOf(issuer)}</span>
            {endSessionUrl && (
                <>
                    {" — "}
                    <a
                        href={endSessionUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline hover:text-gray-700"
                    >
                        sign out there too
                        <span className="sr-only"> (opens in a new tab)</span>
                    </a>
                </>
            )}
        </p>
    );
}

function hostOf(url: string): string {
    try {
        return new URL(url).host;
    } catch {
        return url;
    }
}
