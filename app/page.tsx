"use client";

import { Suspense } from "react";
import AuthWrapper from "./components/AuthWrapper";
import LoadingSpinner from "./components/shared/LoadingSpinner";
import FileManager from "./components/FileManager";

// FileManagerContent uses useSearchParams, so it needs to be wrapped in Suspense
function FileManagerContent() {
  return <FileManager />;
}

export default function Home() {
  return (
    <AuthWrapper>
      <Suspense
        fallback={
          <div className="flex min-h-screen items-center justify-center bg-white">
            <LoadingSpinner size="md" text="Loading..." />
          </div>
        }
      >
        <FileManagerContent />
      </Suspense>
    </AuthWrapper>
  );
}
