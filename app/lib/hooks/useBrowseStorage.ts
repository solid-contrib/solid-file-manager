"use client";

import { useEffect, useState } from "react";
import { getAuthenticatedSession } from "../helpers";
import {
  getSolidDataset,
  getContainedResourceUrlAll,
  getThing,
  getInteger,
  getDatetime,
  getStringNoLocale,
  getIriAll,
  UrlString,
} from "@inrupt/solid-client";
import { DCTERMS, POSIX, RDFS } from "@inrupt/vocab-common-rdf";
import { LDP } from "@inrupt/vocab-common-rdf";
import { FileItemData } from "../../components/FileItem";
import { extractNameFromUrl, resolveUrl, isLikelyFile, isBinaryFile } from "../helpers/urlUtils";

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
        const containerDataset = await getSolidDataset(url, {
          fetch: cacheBustingFetch,
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
            let finalIsContainer = isContainerUrl;

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

              // Check RDF types to determine if it's a container (from container listing metadata)
              // This avoids making individual HTTP requests for each resource
              const types = getIriAll(itemThing, "http://www.w3.org/1999/02/22-rdf-syntax-ns#type");
              const isContainerType = types.some(type =>
                type === LDP.Container ||
                type === LDP.BasicContainer ||
                type === "http://www.w3.org/ns/ldp#Container" ||
                type === "http://www.w3.org/ns/ldp#BasicContainer"
              );

              if (isContainerType) {
                finalIsContainer = true;
              } else {
                // If RDF metadata says it's not a container type, trust it
                // otherwise only treat as container if URL explicitly ends with "/"
                finalIsContainer = isContainerUrl;
              }
            } else {
              // If no RDF metadata available
              if (isContainerUrl) {
                finalIsContainer = true;
              } else if (isBinaryFile(absoluteUrl) || isLikelyFile(absoluteUrl)) {
                finalIsContainer = false;
              } else {
                finalIsContainer = false;
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

