"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FileItemData } from "../../FileItem";
import { useBrowseStorage, type SolidStorage } from "@/app/lib/hooks";

/** Inputs from navigation: which container to list and how to derive related URLs. */
export interface UseContainerBrowseOptions {
  storages: SolidStorage[];
  selectedStorageId: string | null;
  currentPath: string;
  containerUrlToBrowse: string | null;
}

/** Listing data, loading/error, and refresh helpers for the main file pane. */
export interface UseContainerBrowseResult {
  displayFiles: FileItemData[];
  isLoadingFiles: boolean;
  browseError: Error | null;
  availableFolders: FileItemData[];
  getCurrentLocationUrl: () => string;
  refresh: () => void;
  triggerDelayedRefresh: () => void;
}

/**
 * Loads the current container listing and maps it for the UI.
 */
export function useContainerBrowse({
  storages,
  selectedStorageId,
  currentPath,
  containerUrlToBrowse,
}: UseContainerBrowseOptions): UseContainerBrowseResult {
  const [refreshKey, setRefreshKey] = useState(0);
  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch (or reuse cached) contents of containerUrlToBrowse; refreshKey forces a refetch.
  const {
    files: browsedFiles,
    isLoading: isLoadingFiles,
    error: browseError,
  } = useBrowseStorage(containerUrlToBrowse, refreshKey);

  // Clear any pending delayed refresh when the hook unmounts.
  useEffect(() => {
    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
    };
  }, []);

  /** Immediately bump refreshKey so useBrowseStorage reloads the listing. */
  const refresh = useCallback(() => {
    setRefreshKey((prev) => prev + 1);
  }, []);

  /**
   * Debounced refresh after mutations (upload/create/delete).
   * Waits 1s for the server, and collapses rapid calls into one refresh.
   */
  const triggerDelayedRefresh = useCallback(() => {
    if (!containerUrlToBrowse) {
      return;
    }

    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
    }

    refreshTimeoutRef.current = setTimeout(() => {
      setRefreshKey((prev) => prev + 1);
      refreshTimeoutRef.current = null;
    }, 1000);
  }, [containerUrlToBrowse]);

  // Storages shaped as FileItemData so the root view can reuse FileList.
  const storageFiles: FileItemData[] = useMemo(
    () =>
      storages.map((storage) => ({
        id: storage.id,
        name: storage.name,
        type: "folder" as const,
        url: storage.url,
      })),
    [storages],
  );

  // Root: show storages. Inside a storage, show browsed container contents.
  const displayFiles = selectedStorageId ? browsedFiles : storageFiles;

  // Move dialog targets: all storages + folders in the current listing.
  const availableFolders: FileItemData[] = useMemo(
    () => [
      ...storageFiles,
      ...(selectedStorageId
        ? browsedFiles.filter((f) => f.type === "folder")
        : []),
    ],
    [browsedFiles, selectedStorageId, storageFiles],
  );

  /** Absolute URL of the folder the user is currently in (for move dialog, etc.). */
  const getCurrentLocationUrl = useCallback((): string => {
    if (!selectedStorageId) {
      return "";
    }

    if (currentPath === "/") {
      const storage = storages.find((s) => s.id === selectedStorageId);
      return storage?.url || "";
    }
    return currentPath;
  }, [currentPath, selectedStorageId, storages]);

  return {
    displayFiles,
    isLoadingFiles,
    browseError,
    availableFolders,
    getCurrentLocationUrl,
    refresh,
    triggerDelayedRefresh,
  };
}
