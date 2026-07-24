"use client";

import { Suspense } from "react";
import { useRouter } from "next/navigation";
import {
  SolidLoginNavigationProviderNext,
  AuthGuard,
} from "solid-react-component/login/next";
import LoginPage from "../components/LoginPage";

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
          <LoginPage />
        </AuthGuard>
      </SolidLoginNavigationProviderNext>
    </Suspense>
  );
}

