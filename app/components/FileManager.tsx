"use client";

import LoadingSpinner from "./shared/LoadingSpinner";
import ErrorDisplay from "./shared/ErrorDisplay";
import { useSolidStorages } from "../lib/hooks";
import { FileManagerProvider } from "./file-manager";
import FileManagerContent from "./file-manager/FileManagerContent";
import AddStorageForm from "./AddStorageForm";

/**
 * Loads storages, then mounts the file-manager provider and UI.
 * Rendered only for a logged-in user: app/page.tsx wraps it in AuthGuard.
 */
export default function FileManager() {
  const { storages, isLoading, error, addStorage } = useSolidStorages();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <LoadingSpinner size="md" text="Loading your Solid storages..." />
      </div>
    );
  }

  if (error) {
    return (
      <ErrorDisplay
        title="Failed to Load Storages"
        message={error.message || "Unable to discover your Solid storage roots. Please try again."}
        onRetry={() => window.location.reload()}
      />
    );
  }

  if (storages.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <h2 className="mb-2 text-xl font-semibold text-foreground">No Storages Found</h2>
          <p className="text-muted-foreground">
            Your WebID profile doesn&apos;t list a storage. Enter your storage URL to continue.
          </p>
          <AddStorageForm onAdd={addStorage} />
        </div>
      </div>
    );
  }

  return (
    <FileManagerProvider storages={storages}>
      <FileManagerContent />
    </FileManagerProvider>
  );
}
