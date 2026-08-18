"use client";

import { Suspense } from "react";
import AuthWrapper from "./components/AuthWrapper";
import FileManager from "./components/FileManager";
import FullPageLoader from "./components/shared/FullPageLoader";

export default function Home() {
  // FileManager reads search params, which needs a Suspense boundary above it.
  return (
    <Suspense fallback={<FullPageLoader />}>
      <AuthWrapper>
        <FileManager />
      </AuthWrapper>
    </Suspense>
  );
}
