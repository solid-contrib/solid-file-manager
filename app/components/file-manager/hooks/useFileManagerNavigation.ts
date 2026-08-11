"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { FileItemData } from "../../FileItem";
import type { SolidStorage } from "@/app/lib/hooks";
import {
  buildBreadcrumbItems,
  ensureTrailingSlash,
  type BreadcrumbItem,
} from "@/app/lib/helpers";
import {
  getUrlFromSearchParams,
  getUrlFromStorage,
  saveUrlToStorage,
  removeUrlFromStorage,
  safeEncodeUrl,
} from "@/app/lib/helpers";

export interface UseFileManagerNavigationOptions {
  storages: SolidStorage[];
  onClearSelection?: () => void;
  onOpenFile?: (file: FileItemData) => void;
  onFolderNavigated?: () => void;
}

export interface UseFileManagerNavigationResult {
  selectedStorageId: string | null;
  currentPath: string;
  containerUrlToBrowse: string | null;
  breadcrumbItems: BreadcrumbItem[];
  updateUrl: (url: string | null, addToHistory?: boolean) => void;
  navigateToBreadcrumb: (path: string) => void;
  navigateToFolder: (folderUrl: string) => void;
  navigateToFile: (file: FileItemData) => void;
  setCurrentPath: (path: string) => void;
}

export function useFileManagerNavigation({
  storages,
  onClearSelection,
  onOpenFile,
  onFolderNavigated,
}: UseFileManagerNavigationOptions): UseFileManagerNavigationResult {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [selectedStorageId, setSelectedStorageId] = useState<string | null>(
    null,
  );
  const [currentPath, setCurrentPath] = useState<string>("/");
  const [isInitialized, setIsInitialized] = useState(false);

  // Back / forward navigation
  useEffect(() => {
    if (storages.length === 0 || !isInitialized) {
      return;
    }

    const urlParam = getUrlFromSearchParams();

    if (!urlParam) {
      if (selectedStorageId) {
        const storage = storages.find((s) => s.id === selectedStorageId);
        if (storage) {
          setCurrentPath("/");
          removeUrlFromStorage();
        }
      }
      return;
    }

    const matchingStorage = storages.find(
      (s) => urlParam === s.url || urlParam.startsWith(s.url),
    );

    if (matchingStorage) {
      setSelectedStorageId(matchingStorage.id);
      setCurrentPath(urlParam === matchingStorage.url ? "/" : urlParam);
      saveUrlToStorage(urlParam);
    }
  }, [searchParams, storages, isInitialized, selectedStorageId]);

  // Initial URL from search params / session storage
  useEffect(() => {
    if (storages.length === 0 || isInitialized) {
      return;
    }
    const urlParam = getUrlFromSearchParams() || getUrlFromStorage();

    if (!urlParam) {
      setIsInitialized(true);
      return;
    }

    saveUrlToStorage(urlParam);

    try {
      const matchingStorage = storages.find(
        (s) => urlParam === s.url || urlParam.startsWith(s.url),
      );

      if (matchingStorage) {
        setSelectedStorageId(matchingStorage.id);
        setCurrentPath(urlParam === matchingStorage.url ? "/" : urlParam);

        if (typeof window !== "undefined") {
          const params = new URLSearchParams();
          params.set("url", safeEncodeUrl(urlParam));
          router.replace(`/?${params.toString()}`, { scroll: false });
        }

        setIsInitialized(true);
        return;
      }
    } catch (e) {
      console.error("Failed to set initial URL:", e);
    }

    setIsInitialized(true);
  }, [searchParams, storages, isInitialized, router]);

  const updateUrl = useCallback(
    (url: string | null, addToHistory: boolean = true) => {
      if (!url || url === "/") {
        removeUrlFromStorage();
        if (typeof window !== "undefined" && window.location.search) {
          if (addToHistory) {
            router.push("/", { scroll: false });
          } else {
            router.replace("/", { scroll: false });
          }
        }
        return;
      }

      const params = new URLSearchParams();
      params.set("url", safeEncodeUrl(url));
      saveUrlToStorage(url);

      if (addToHistory) {
        router.push(`/?${params.toString()}`, { scroll: false });
      } else {
        router.replace(`/?${params.toString()}`, { scroll: false });
      }
    },
    [router],
  );

  const containerUrlToBrowse = selectedStorageId
    ? currentPath === "/"
      ? storages.find((s) => s.id === selectedStorageId)?.url || null
      : currentPath
    : null;

  const selectedStorage = storages.find((s) => s.id === selectedStorageId);
  const breadcrumbItems = buildBreadcrumbItems(
    selectedStorageId,
    selectedStorage?.url,
    selectedStorage?.name,
    currentPath,
  );

  const navigateToBreadcrumb = useCallback(
    (path: string) => {
      if (path === "/") {
        setSelectedStorageId(null);
        setCurrentPath("/");
        onClearSelection?.();
        updateUrl(null, true);
        return;
      }

      const storage = storages.find((s) => s.id === selectedStorageId);
      if (storage && path === storage.url) {
        setCurrentPath("/");
        updateUrl(storage.url, true);
      } else {
        setCurrentPath(path);
        updateUrl(path, true);
      }
      onClearSelection?.();
    },
    [onClearSelection, selectedStorageId, storages, updateUrl],
  );

  const navigateToFolder = useCallback(
    (folderUrl: string) => {
      const normalizedUrl = ensureTrailingSlash(folderUrl);
      const matchingStorage = storages.find(
        (s) =>
          normalizedUrl === ensureTrailingSlash(s.url) ||
          normalizedUrl.startsWith(ensureTrailingSlash(s.url)),
      );

      if (!matchingStorage) {
        return;
      }

      setSelectedStorageId(matchingStorage.id);
      onClearSelection?.();

      if (normalizedUrl === ensureTrailingSlash(matchingStorage.url)) {
        setCurrentPath("/");
        updateUrl(matchingStorage.url, true);
      } else {
        setCurrentPath(normalizedUrl);
        updateUrl(normalizedUrl, true);
      }

      onFolderNavigated?.();
    },
    [onClearSelection, onFolderNavigated, storages, updateUrl],
  );

  const navigateToFile = useCallback(
    (file: FileItemData) => {
      if (file.type === "folder") {
        const isStorage = storages.some((s) => s.id === file.id);

        if (!selectedStorageId && isStorage) {
          setSelectedStorageId(file.id);
          setCurrentPath("/");
          onClearSelection?.();
          updateUrl(file.url, true);
        } else if (selectedStorageId) {
          setCurrentPath(file.url);
          onClearSelection?.();
          updateUrl(file.url, true);
        }
        return;
      }
      onOpenFile?.(file);
    },
    [onClearSelection, onOpenFile, selectedStorageId, storages, updateUrl],
  );

  return {
    selectedStorageId,
    currentPath,
    containerUrlToBrowse,
    breadcrumbItems,
    updateUrl,
    navigateToBreadcrumb,
    navigateToFile,
    navigateToFolder,
    setCurrentPath,
  };
}
