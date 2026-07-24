"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SolidLoginPage } from "solid-react-component/login/next";
import { getLastIdp, saveLastIdp } from "../lib/helpers/idpHistoryUtils";


export default function LoginPage() {
    const router = useRouter();
    const [mounted, setMounted] = useState(false);
    const [defaultIssuer, setDefaultIssuer] = useState("");

    useEffect(() => {
        setDefaultIssuer(getLastIdp());
        setMounted(true);
    }, []);

    const handleSubmit = (event: React.FormEvent<HTMLDivElement>) => {
        const input = event.currentTarget.querySelector("input");
        if (input instanceof HTMLInputElement) {
            saveLastIdp(input.value);
        }
    };

    // Render only after localStorage is read, so defaultIssuer is applied on
    // SolidLoginPage's initial mount (it reads defaultIssuer only once).
    if (!mounted) return null;

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