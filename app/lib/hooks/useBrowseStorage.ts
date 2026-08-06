"use client";

import { useEffect, useState } from "react";
import { getAuthenticatedSession } from "../helpers";
import { getSolidDataset, toRdfJsDataset } from "@inrupt/solid-client";
import { FileItemData } from "../../components/FileItem";
import { ContainerDataset } from "../class/ContainerDataset";
import { DataFactory } from "n3";
import { loadContainerListing } from "../cache";

interface UseBrowseStorageResult {
  files: FileItemData[];
  isLoading: boolean;
  error: Error | null;
}

async function fetchContainerListing(
  url: string,
  fetchFn: typeof fetch,
): Promise<FileItemData[]> {
  const container = new ContainerDataset(
    toRdfJsDataset(await getSolidDataset(url, { fetch: fetchFn })),
    DataFactory,
  ).container;

  if (container === undefined) {
    throw new Error("Container not found");
  }

  const fileItems: FileItemData[] = [];

  for (const item of container.contains) {
    try {
      let mimeType = item.mimeType;

      // For non-folder filed, only fetch content-type if not already in the RDF metadata
      if (!item.isContainer && !mimeType) {
        try {
          const headResponse = await fetchFn(item.id, {
            method: "HEAD",
            headers: {
              Accept: "*/*",
            },
          });

          if (headResponse.ok) {
            const contentType = headResponse.headers.get("Content-Type");
            if (contentType) {
              mimeType = contentType.split(";")[0].trim();
            }
          }
        } catch (err) {
          console.debug(`Could not fetch content-type for ${item}:`, err);
        }
      }

      fileItems.push({
        id: item.id,
        name: item.name,
        type: item.fileType,
        url: item.id,
        lastModified: item.lastModified,
        size: item.size,
        mimeType,
      });
    } catch (err) {
      console.error(`Failed to process item ${item}:`, err);
    }
  }

  // sort by folder first then in alphabetical order using the name
  fileItems.sort((a, b) => {
    if (a.type === "folder" && b.type !== "folder") return -1;
    if (a.type !== "folder" && b.type === "folder") return 1;
    return a.name.localeCompare(b.name);
  });

  return fileItems;
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
