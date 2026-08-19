"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FileItemData } from "../../FileItem";
import { useBrowseStorage, type SolidStorage } from "@/app/lib/hooks";
import { invalidateContainerListing } from "@/app/lib/cache";

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
  invalidateContainers: (urls: Array<string | null | undefined>) => void;
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

  /** Drop cache for the current container, then force the main list to refetch. */
  const refresh = useCallback(() => {
    if (containerUrlToBrowse) {
      invalidateContainerListing(containerUrlToBrowse);
    }
    setRefreshKey((prev) => prev + 1);
  }, [containerUrlToBrowse]);

  /**
   * Debounced refresh after mutations (upload/create/delete).
   * Invalidates shared cache so that FolderTree does not keep stale children.
   */
  const triggerDelayedRefresh = useCallback(() => {
    if (!containerUrlToBrowse) {
      return;
    }

    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
    }

    // Invalidate immediately so any concurrent tree read misses cache
    invalidateContainerListing(containerUrlToBrowse);

    refreshTimeoutRef.current = setTimeout(() => {
      setRefreshKey((prev) => prev + 1);
      refreshTimeoutRef.current = null;
    }, 1000);
  }, [containerUrlToBrowse]);

  /**
   * Invalidate specific container URLs in the shared cache.
   * Used when a mutation affects folders other than the current one (e.g. move destination).
   */
  const invalidateContainers = useCallback(
    (urls: Array<string | null | undefined>) => {
      for (const url of urls) {
        if (url) {
          invalidateContainerListing(url);
        }
      }
    },
    [],
  );

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
    invalidateContainers,
  };
}
