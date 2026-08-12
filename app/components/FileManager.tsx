"use client";

import AuthWrapper from "./AuthWrapper";
import LoadingSpinner from "./shared/LoadingSpinner";
import ErrorDisplay from "./shared/ErrorDisplay";
import { useSolidStorages } from "../lib/hooks";
import { FileManagerProvider } from "./file-manager";
import FileManagerContent from "./file-manager/FileManagerContent";

/** Loads storages, then mounts the file-manager provider and UI. */
export default function FileManager() {
  const { storages, isLoading, error } = useSolidStorages();

  if (isLoading) {
    return (
      <AuthWrapper>
        <div className="flex min-h-screen items-center justify-center bg-white">
          <LoadingSpinner size="md" text="Loading your Solid storages..." />
        </div>
      </AuthWrapper>
    );
  }

  if (error) {
    return (
      <AuthWrapper>
        <ErrorDisplay
          title="Failed to Load Storages"
          message={error.message || "Unable to discover your Solid storage roots. Please try again."}
          onRetry={() => window.location.reload()}
        />
      </AuthWrapper>
    );
  }

  if (storages.length === 0) {
    return (
      <AuthWrapper>
        <div className="flex min-h-screen items-center justify-center bg-white">
          <div className="text-center">
            <h2 className="mb-2 text-xl font-semibold text-black">No Storages Found</h2>
            <p className="text-gray-600">
              Unable to discover any Solid storage roots from your WebID profile.
            </p>
          </div>
        </div>
      </AuthWrapper>
    );
  }

  return (
    <AuthWrapper>
      <FileManagerProvider storages={storages}>
        <FileManagerContent />
      </FileManagerProvider>
    </AuthWrapper>
  );
}
