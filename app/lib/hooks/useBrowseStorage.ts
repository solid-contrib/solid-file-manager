"use client";

import { useEffect, useState } from "react";
import { getAuthFetch } from "../auth/manager";
import { getSolidDataset, toRdfJsDataset } from "@inrupt/solid-client";
import { FileItemData } from "../../components/FileItem";
import { ContainerDataset } from "@solid/object/solid";
import { DataFactory } from "n3";

interface UseBrowseStorageResult {
  files: FileItemData[];
  isLoading: boolean;
  error: Error | null;
}

/**
 * Hook to browse/list the contents of a Solid storage container
 */
export function useBrowseStorage(containerUrl: string | null, refreshKey?: number): UseBrowseStorageResult {
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

    async function browseContainer() {
      try {
        setIsLoading(true);
        setError(null);

        const fetchFn = getAuthFetch();

        // This is a cache-busting fetch wrapper for when refreshKey is provided
        // This ensures we get fresh data after uploads/deletes
        const cacheBustingFetch = refreshKey !== undefined && refreshKey > 0
          ? (input: RequestInfo | URL, init?: RequestInit) => {
            const headers = new Headers(init?.headers);
            // Adding cache-control headers to bypass browser/server cache
            headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
            headers.set('Pragma', 'no-cache');
            return fetchFn(input, { ...init, headers, cache: 'no-store' });
          }
          : fetchFn;

        // Use @inrupt/solid-client to fetch the container dataset
        // and map it to plain object-oriented classes using rdfjs-wrapper
        const container =
            new ContainerDataset(
                toRdfJsDataset(await getSolidDataset(url, {fetch: cacheBustingFetch})),
                DataFactory)
                .container

        if (container === undefined) {
          throw new Error() // TODO: Handle properly
        }

        const fileItems: FileItemData[] = [];

        for (const item of container.contains) {
          try {
            let mimeType = item.mimeType;

            // For non-folder files, only fetch content-type if not already found in RDF metadata
            if (!item.isContainer && !mimeType) {
              try {
                const headResponse = await cacheBustingFetch(item.id, {
                  method: "HEAD",
                  headers: {
                    Accept: "*/*",
                  },
                });
                
                if (headResponse.ok) {
                  const contentType = headResponse.headers.get("Content-Type");
                  if (contentType) {
                    // Extract just the MIME type (remove charset, etc.)
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

        setFiles(fileItems);
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err : new Error("Failed to browse storage container");
        setError(errorMessage);
        setFiles([]);
      } finally {
        setIsLoading(false);
      }
    }

    browseContainer();
  }, [containerUrl, refreshKey]); // refreshKey triggers re-fetch when it changes

  return { files, isLoading, error };
}

