"use client";

import { useEffect, useState } from "react";
import { getAuthenticatedSession } from "../helpers";
import {
  getSolidDataset,
  getContainedResourceUrlAll,
  isContainer,
  getThing,
  getInteger,
  getDatetime,
  getStringNoLocale,
  UrlString,
} from "@inrupt/solid-client";
import { DCTERMS, POSIX, RDFS } from "@inrupt/vocab-common-rdf";
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

        const { fetch: fetchFn } = getAuthenticatedSession();

        // Use @inrupt/solid-client to fetch the container dataset
        const containerDataset = await getSolidDataset(url, {
          fetch: fetchFn,
        });

        // Get all contained resource URLs using @inrupt/solid-client
        const containedUrls = getContainedResourceUrlAll(containerDataset);

        const fileItems: FileItemData[] = [];

        for (const itemUrl of containedUrls) {
          try {
            const absoluteUrl = resolveUrl(itemUrl, url) as UrlString;
            const isContainerUrl = absoluteUrl.endsWith("/");
            
            // Try to get preferred name in this order:
            // 1. RDF metadata from container (dcterms:title or rdfs:label)
            // 2. URL extraction (fallback)
            let name = extractNameFromUrl(absoluteUrl);
            let lastModified: Date | undefined;
            let size: number | undefined;

            // Check RDF metadata from container dataset- using getThing because it reads a resource (thing) from the RDF dataset to access properties like dcterms:title, rdfs:label, dcterms:modified, posix:size
            const itemThing = getThing(containerDataset, absoluteUrl);
            if (itemThing) {
              // Check for preferred name in metadata (dcterms:title or rdfs:label)
              const title = getStringNoLocale(itemThing, DCTERMS.title);
              if (title) {
                name = title;
              } else {
                const label = getStringNoLocale(itemThing, RDFS.label);
                if (label) {
                  name = label;
                }
              }

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

            let finalIsContainer = isContainerUrl;

            if (!isContainerUrl && !isLikelyFile(absoluteUrl)) {
              try {
                const itemDataset = await getSolidDataset(absoluteUrl, {
                  fetch: fetchFn,
                });
                finalIsContainer = isContainer(itemDataset);
              } catch (e: any) {
                const statusCode = e?.response?.status;
                const errorMessage = e instanceof Error ? e.message : String(e);
                
                // Check if it's a 501 error (binary file that can't be converted to RDF)
                if (statusCode === 501 || 
                    errorMessage.includes("501") || 
                    errorMessage.includes("Not Implemented") ||
                    errorMessage.includes("No conversion path")) {
                  // Binary file that can't be converted to RDF - treat as file
                  finalIsContainer = false;
                } else {
                  // Other errors (404, 403, etc.) - assume it's a file
                  finalIsContainer = false;
                }
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
            console.error(`Failed to process item ${itemUrl}:`, err);
          }
        }

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
  }, [containerUrl, refreshKey]);

  return { files, isLoading, error };
}

