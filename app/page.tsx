"use client";

import { Suspense } from "react";
import {
  SolidLoginNavigationProviderNext,
  AuthGuard,
} from "solid-react-component/login/next";
import LoadingSpinner from "./components/shared/LoadingSpinner";
import FileManager from "./components/FileManager";

const loadingFallback = (
  <div className="flex min-h-screen items-center justify-center bg-white">
    <LoadingSpinner size="md" text="Loading..." />
  </div>
);

function FileManagerContent() {
  return <FileManager />;
}

export default function Home() {
  return (
    <Suspense fallback={loadingFallback}>
      <SolidLoginNavigationProviderNext
        config={{ loginPath: "/login", homePath: "/" }}
      >
        <AuthGuard fallback={loadingFallback}>
          <FileManagerContent />
        </AuthGuard>
      </SolidLoginNavigationProviderNext>
    </Suspense>
  );
}
