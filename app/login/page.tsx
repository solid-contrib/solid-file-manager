"use client";

import { Suspense } from "react";
import { useRouter } from "next/navigation";
import {
  SolidLoginNavigationProviderNext,
  AuthGuard,
  SolidLoginPage,
} from "solid-react-component/login/next";

const loadingFallback = (
  <div className="flex min-h-screen items-center justify-center bg-white">
    <span>Loading...</span>
  </div>
);

export default function Login() {
  const router = useRouter();
  return (
    <Suspense fallback={loadingFallback}>
      <SolidLoginNavigationProviderNext
        config={{ loginPath: "/login", homePath: "/" }}
      >
        <AuthGuard fallback={loadingFallback}>
          <SolidLoginPage
            onAlreadyLoggedIn={() => router.replace("/")}
            logo="/file-manager-logo.svg"
            logoAlt="Solid File Manager Logo"
            title="Sign in"
            subtitle="to continue to Solid File Manager"
            footerGitHubUrl="https://github.com/solid/solid-file-manager"
            footerIssuesUrl="https://github.com/solid/solid-file-manager/issues/new"
          />
        </AuthGuard>
      </SolidLoginNavigationProviderNext>
    </Suspense>
  );
}

