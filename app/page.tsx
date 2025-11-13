"use client";

import { Suspense } from "react";
import AuthWrapper from "./components/AuthWrapper";
import LoadingSpinner from "./components/shared/LoadingSpinner";
import FileManager from "./components/FileManager";

export default function Home() {
  return (
    <Suspense
      fallback={
        <AuthWrapper>
          <div className="flex min-h-screen items-center justify-center bg-white">
            <LoadingSpinner size="md" text="Loading..." />
          </div>
        </AuthWrapper>
      }
    >
      <FileManager />
    </Suspense>
  );
}
