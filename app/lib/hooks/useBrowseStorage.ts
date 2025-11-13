"use client";

import { useEffect, useState } from "react";
import { getDefaultSession } from "@inrupt/solid-client-authn-browser";
import {
  getSolidDataset,
  getContainedResourceUrlAll,
  isContainer,
  getThing,
  getInteger,
  getDatetime,
  UrlString,
} from "@inrupt/solid-client";
import { fetch } from "@inrupt/solid-client-authn-browser";
import { DCTERMS, POSIX } from "@inrupt/vocab-common-rdf";
import { FileItemData } from "../../components/FileItem";
import { extractNameFromUrl, resolveUrl, isLikelyFile } from "../helpers/urlUtils";

interface UseBrowseStorageResult {
  files: FileItemData[];
  isLoading: boolean;
  error: Error | null;
}

/**
 * Hook to browse/list the contents of a Solid storage container
 * Uses LDP to fetch and parse container contents
 */
export function useBrowseStorage(containerUrl: string | null): UseBrowseStorageResult {
  const [files, setFiles] = useState<FileItemData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!containerUrl) {
      setFiles([]);
      setIsLoading(false);
      return;
    }

    const urlToBrowse = containerUrl;

    async function browseContainer() {
      try {
        setIsLoading(true);
        setError(null);

        const session = getDefaultSession();
        if (!session.info.isLoggedIn) {
          throw new Error("Not authenticated");
        }

        const url = urlToBrowse.endsWith("/") ? urlToBrowse : urlToBrowse + "/";
  

        // Use @inrupt/solid-client to fetch the container dataset
        const containerDataset = await getSolidDataset(url, {
          fetch: fetch,
        });

        // Get all contained resource URLs using @inrupt/solid-client
        const containedUrls = getContainedResourceUrlAll(containerDataset);

        const fileItems: FileItemData[] = [];

        for (const itemUrl of containedUrls) {
          try {
            const absoluteUrl = resolveUrl(itemUrl, url) as UrlString;
            const isContainerUrl = absoluteUrl.endsWith("/");
            const name = extractNameFromUrl(absoluteUrl);

            let finalIsContainer = isContainerUrl;
            let lastModified: Date | undefined;
            let size: number | undefined;

            const itemThing = getThing(containerDataset, absoluteUrl);
            if (itemThing) {
              const modifiedDate = getDatetime(itemThing, DCTERMS.modified);
              if (modifiedDate) {
                lastModified = modifiedDate;
              }
              
              if (!lastModified) {
                const mtime = getDatetime(itemThing, POSIX.mtime);
                if (mtime) {
                  lastModified = mtime;
                }
              }

              const fileSize = getInteger(itemThing, POSIX.size);
              if (fileSize !== null) {
                size = fileSize;
              }
            }

            if (!isContainerUrl && !isLikelyFile(absoluteUrl)) {
              try {
                const itemDataset = await getSolidDataset(absoluteUrl, {
                  fetch: fetch,
                });
                finalIsContainer = isContainer(itemDataset);
              } catch (e) {
                // Continue on error
              }
            }

            fileItems.push({
              id: absoluteUrl,
              name,
              type: finalIsContainer ? "folder" : "file",
              url: absoluteUrl,
              lastModified,
              size,
            });
          } catch (err) {
            // Continue on error
          }
        }

        fileItems.sort((a, b) => {
          if (a.type === "folder" && b.type !== "folder") return -1;
          if (a.type !== "folder" && b.type === "folder") return 1;
          return a.name.localeCompare(b.name);
        });

        console.log(`Resources:`, fileItems.map(item => ({
          name: item.name,
          type: item.type,
          url: item.url
        })));
        
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
  }, [containerUrl]);

  return { files, isLoading, error };
}

