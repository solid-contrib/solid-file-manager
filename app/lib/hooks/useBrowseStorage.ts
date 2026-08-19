"use client";

import { useEffect, useState } from "react";
import { getAuthenticatedSession } from "../helpers";
import { FileItemData } from "../../components/FileItem";
import { loadContainerListing } from "../cache";
import { fetchContainerListing } from "../helpers/containerListingUtils";

interface UseBrowseStorageResult {
  files: FileItemData[];
  isLoading: boolean;
  error: Error | null;
}


/**
 * Hook to browse/list the contents of a Solid storage container
 * Uses the shared container cache so the sidebar can reuse the same listing
 */
export function useBrowseStorage(
  containerUrl: string | null,
  refreshKey?: number,
): UseBrowseStorageResult {
  const [files, setFiles] = useState<FileItemData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!containerUrl) {
      setFiles([]);
      setIsLoading(false);
      return;
    }

    const url = containerUrl;
    const forceRefresh = refreshKey !== undefined && refreshKey > 0;

    async function browseContainer() {
      try {
        setIsLoading(true);
        setError(null);

        const { fetch: fetchFn } = getAuthenticatedSession();

        // After mutations, bypass HTTP cache as well as the in-memory listing cache
        const requestFetch = forceRefresh
          ? (input: RequestInfo | URL, init?: RequestInit) => {
              const headers = new Headers(init?.headers);
              headers.set(
                "Cache-Control",
                "no-cache, no-store, must-revalidate",
              );
              headers.set("Pragma", "no-cache");
              return fetchFn(input, {
                ...init,
                headers,
                cache: "no-store",
              });
            }
          : fetchFn;

        const fileItems = await loadContainerListing(
          url,
          () => fetchContainerListing(url, requestFetch),
          { force: forceRefresh },
        );

        setFiles(fileItems);
      } catch (err) {
        const errorMessage =
          err instanceof Error
            ? err
            : new Error("Failed to browse storage container");
        setError(errorMessage);
        setFiles([]);
      } finally {
        setIsLoading(false);
      }
    }

    browseContainer();
  }, [containerUrl, refreshKey]); 

  return { files, isLoading, error };
}
