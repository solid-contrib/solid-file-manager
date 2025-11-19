"use client";

import { useEffect, useState, useRef } from "react";
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
import { getDisplayNameFromMeta } from "../helpers/metaFileUtils";

interface UseBrowseStorageResult {
  files: FileItemData[];
  isLoading: boolean;
  error: Error | null;
}

// In-memory cache for container contents
// Key: normalized URL (with trailing slash), Value: cached files
const containerCache = new Map<string, FileItemData[]>();

/**
 * Hook to browse/list the contents of a Solid storage container
 * Uses LDP to fetch and parse container contents
 */
export function useBrowseStorage(containerUrl: string | null, refreshKey?: number): UseBrowseStorageResult {
  const [files, setFiles] = useState<FileItemData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const lastUrlRef = useRef<string | null>(null);
  const lastRefreshKeyRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!containerUrl) {
      setFiles([]);
      setIsLoading(false);
      lastUrlRef.current = null;
      return;
    }

    // Normalize URL (ensure trailing slash for consistency)
    const normalizedUrl = containerUrl.endsWith("/") ? containerUrl : containerUrl + "/";
    
    // Check if we should use cached data
    // Use cache if: no explicit refresh requested and cache exists for this URL
    const shouldUseCache = 
      refreshKey === undefined && 
      containerCache.has(normalizedUrl);

    if (shouldUseCache) {
      // Use cached data immediately
      const cachedFiles = containerCache.get(normalizedUrl)!;
      setFiles(cachedFiles);
      setIsLoading(false);
      setError(null);
      // Update refs to track current URL
      lastUrlRef.current = normalizedUrl;
      lastRefreshKeyRef.current = refreshKey;
      return;
    }

    // Update refs
    lastUrlRef.current = normalizedUrl;
    lastRefreshKeyRef.current = refreshKey;

    async function browseContainer() {
      try {
        setIsLoading(true);
        setError(null);

        const { fetch: fetchFn } = getAuthenticatedSession();

        const url = normalizedUrl;
  
        // Create a fetch function that bypasses cache when refreshKey is provided
        const fetchWithCacheBust = refreshKey !== undefined
          ? async (input: RequestInfo | URL, init?: RequestInit) => {
              const urlWithCacheBust = typeof input === 'string' 
                ? `${input}${input.includes('?') ? '&' : '?'}_t=${Date.now()}`
                : input;
              return fetchFn(urlWithCacheBust, {
                ...init,
                cache: 'no-store',
                headers: {
                  ...init?.headers,
                  'Cache-Control': 'no-cache',
                },
              });
            }
          : fetchFn;

        // Use @inrupt/solid-client to fetch the container dataset
        const containerDataset = await getSolidDataset(url, {
          fetch: fetchWithCacheBust,
        });

        // Get all contained resource URLs using @inrupt/solid-client
        const containedUrls = getContainedResourceUrlAll(containerDataset);

        const fileItems: FileItemData[] = [];

        for (const itemUrl of containedUrls) {
          try {
            const absoluteUrl = resolveUrl(itemUrl, url) as UrlString;
            const isContainerUrl = absoluteUrl.endsWith("/");
            
            // Try to get preferred name in this order:
            // 1. .meta file (standard Solid metadata)
            // 2. RDF metadata from container (dcterms:title or rdfs:label)
            // 3. URL extraction (fallback)
            let name = extractNameFromUrl(absoluteUrl);
            let lastModified: Date | undefined;
            let size: number | undefined;

            // Check .meta file first (standard Solid approach)
            const metaName = await getDisplayNameFromMeta(absoluteUrl, fetchWithCacheBust);
            if (metaName) {
              name = metaName;
            } else {
              // Check RDF metadata from container dataset
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
            }

            let finalIsContainer = isContainerUrl;

            if (!isContainerUrl && !isLikelyFile(absoluteUrl)) {
              try {
                const itemDataset = await getSolidDataset(absoluteUrl, {
                  fetch: fetchWithCacheBust,
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
        
        // Cache the results
        containerCache.set(normalizedUrl, fileItems);
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

