"use client";
import { useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { SolidLoginPage } from "solid-react-component/login/next";
import { getLastIdp, saveLastIdp } from "../lib/helpers/idpHistoryUtils";

function subscribeNoop() {
    return () => { };
}

export default function LoginPage() {
    const router = useRouter();
    const isClient = useSyncExternalStore(subscribeNoop, () => true, () => false);
    const defaultIssuer = useSyncExternalStore(
        subscribeNoop,
        () => getLastIdp(),
        () => "",
    );

    const handleSubmit = (event: React.FormEvent<HTMLDivElement>) => {
        const input = event.currentTarget.querySelector("input");
        if (input instanceof HTMLInputElement) {
            saveLastIdp(input.value);
        }
    };

    // Client-only render so SolidLoginPage reads defaultIssuer on first mount.
    if (!isClient) return null;

    return (
        <div onSubmit={handleSubmit}>
            <SolidLoginPage
                onAlreadyLoggedIn={() => router.replace("/")}
                defaultIssuer={defaultIssuer}
                logo="/file-manager-logo.svg"
                logoAlt="Solid File Manager Logo"
                title="Sign in"
                subtitle="to continue to Solid File Manager"
                footerGitHubUrl="https://github.com/solid/solid-file-manager"
                footerIssuesUrl="https://github.com/solid/solid-file-manager/issues/new"
            />
        </div>
    )
}
