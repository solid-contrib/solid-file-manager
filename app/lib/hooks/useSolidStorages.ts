"use client";

import { useEffect, useState } from "react";
import { Parser, Store, NamedNode } from "n3";
import { allowOrigin, getAuthFetch } from "../auth/manager";
import { fetchAndParseProfile } from "../helpers/profileUtils";
import { useSolidAuth } from "./useSolidAuth";

// Storage predicates and types
const PIM_STORAGE_TYPE = "http://www.w3.org/ns/pim/space#Storage";
const RDF_TYPE = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";

export interface SolidStorage {
  id: string;
  name: string;
  url: string;
}

interface UseSolidStoragesResult {
  storages: SolidStorage[];
  isLoading: boolean;
  error: Error | null;
}

/**
 * Discovers storage by traversing up the folder hierarchy from the WebID
 * Based on: https://github.com/SolidLabResearch/Bashlib/blob/80de25cbb4b3ed057f95e25bc057f1be9b00cef3/src/utils/util.ts#L73-L104
 * @param {string} webId - The WebID to start traversal from
 * @param {typeof fetch} fetchFn - The fetch function to use (should be authenticated)
 * @returns {Promise<string[]>} - Array of storage URLs found via traversal
 */
async function discoverStorageViaTraversal(
  webId: string,
  fetchFn: typeof fetch,
): Promise<string[]> {
  const storageUrls: string[] = [];

  try {
    // Extract the base URL from the WebID (remove fragment)
    const url = new URL(webId);
    const baseUrl = `${url.origin}${url.pathname}`;

    // Start from the parent directory of the WebID
    let currentUrl = baseUrl.substring(0, baseUrl.lastIndexOf("/") + 1);

    // Traverse up the hierarchy
    const maxLevels = 10; // Prevent infinite loops
    let level = 0;

    while (currentUrl && level < maxLevels) {
      try {
        // Fetch the container with content negotiation
        const response = await fetchFn(currentUrl, {
          method: "GET",
          headers: {
            Accept: "text/turtle, application/ld+json, */*;q=0.1",
          },
        });

        if (!response.ok) {
          // Move up one level and continue
          const parentUrl = currentUrl.substring(
            0,
            currentUrl.lastIndexOf("/", currentUrl.length - 2) + 1,
          );
          if (parentUrl === currentUrl || parentUrl === `${url.origin}/`) {
            break; // Reached root
          }
          currentUrl = parentUrl;
          level++;
          continue;
        }

        const contentType = response.headers.get("Content-Type") || "";
        const content = await response.text();

        // Parse the RDF content
        const store = new Store();
        if (
          contentType.includes("text/turtle") ||
          contentType.includes("application/turtle") ||
          contentType.includes("text/n3") ||
          contentType.includes("application/n3")
        ) {
          const parser = new Parser({ baseIRI: currentUrl });
          const quads = parser.parse(content);
          store.addQuads(quads);
        } else {
          // Try parsing as Turtle anyway (some servers don't set content-type correctly)
          try {
            const parser = new Parser({ baseIRI: currentUrl });
            const quads = parser.parse(content);
            store.addQuads(quads);
          } catch {
            // Not RDF we can read. Move up one level and continue.
            const parentUrl = currentUrl.substring(0, currentUrl.lastIndexOf('/', currentUrl.length - 2) + 1);
            if (parentUrl === currentUrl || parentUrl === `${url.origin}/`) {
              break;
            }
            currentUrl = parentUrl;
            level++;
            continue;
          }
        }

        const containerNode = new NamedNode(currentUrl);
        const rdfType = new NamedNode(RDF_TYPE);
        const pimStorageType = new NamedNode(PIM_STORAGE_TYPE);

        // Check if this container is of type pim:Storage
        const typeQuads = store.getQuads(
          containerNode,
          rdfType,
          pimStorageType,
          null,
        );
        const isStorage = typeQuads.length > 0;

        if (isStorage) {
          // Ensure URL ends with /
          const storageUrl = currentUrl.endsWith("/")
            ? currentUrl
            : currentUrl + "/";
          storageUrls.push(storageUrl);
          break; // Found storage, no need to continue
        }

        // Move up one level
        const parentUrl = currentUrl.substring(
          0,
          currentUrl.lastIndexOf("/", currentUrl.length - 2) + 1,
        );
        if (parentUrl === currentUrl || parentUrl === `${url.origin}/`) {
          break; // Reached root
        }
        currentUrl = parentUrl;
        level++;
      } catch {
        // If we can't fetch a container, try the parent
        const parentUrl = currentUrl.substring(
          0,
          currentUrl.lastIndexOf("/", currentUrl.length - 2) + 1,
        );
        if (parentUrl === currentUrl || parentUrl === `${url.origin}/`) {
          break;
        }
        currentUrl = parentUrl;
        level++;
      }
    }
  } catch (error) {
    console.warn("Could not traverse the WebID hierarchy for a storage root", error);
  }

  return storageUrls;
}

/**
 * Hook to fetch Solid storage roots from the user's WebID profile.
 * Uses two methods:
 * 1. Direct RDF parsing to discover storage locations via pim:storage and solid:storage predicates
 * 2. Hierarchical traversal to find pim:Storage containers by walking up the directory tree
 */
export function useSolidStorages(): UseSolidStoragesResult {
  const { session } = useSolidAuth();
  const { isLoggedIn, webId } = session;
  const [storages, setStorages] = useState<SolidStorage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function fetchStorages() {
      try {
        if (!isMounted) return;

        setIsLoading(true);
        setError(null);

        // Wait for authentication to complete
        if (!isLoggedIn || !webId) {
          setIsLoading(false);
          return;
        }

        // Use shared profile fetching utility (with caching)
        const mainSubject = await fetchAndParseProfile(webId);

        // Get storage roots using both pim:storage and solid:storage predicates
        const storageUrls: Set<string> = mainSubject.storageUrls;

        // Method 2: Hierarchical traversal (if no storage found via predicates)
        // Based on: https://github.com/SolidLabResearch/Bashlib/blob/80de25cbb4b3ed057f95e25bc057f1be9b00cef3/src/utils/util.ts#L73-L104
        if (storageUrls.size === 0) {
          try {
            const traversalStorages = await discoverStorageViaTraversal(webId, getAuthFetch());
            traversalStorages.forEach(url => {
              if (!storageUrls.has(url)) {
                storageUrls.add(url);
              }
            });
          } catch (err) {
            console.warn("Storage traversal from the WebID failed", err);
          }
        }

        // Last resort: assume the pod is at the root of the WebID's own origin.
        if (storageUrls.size === 0) {
          storageUrls.add(new URL(webId).origin + "/");
        }

        // A pod usually lives on a different origin from the WebID, so it has
        // to be vouched for before anything will authenticate against it.
        storageUrls.forEach((url) => allowOrigin(url));

        // Convert to SolidStorage format
        const discoveredStorages: SolidStorage[] = [...storageUrls].map(
          (url) => {
            return {
              id: url,
              name: url,
              url: url,
            };
          },
        );

        setStorages(discoveredStorages);
      } catch (err) {
        const errorMessage =
          err instanceof Error
            ? err
            : new Error("Failed to fetch storage roots");
        setError(errorMessage);
        setStorages([]);
      } finally {
        setIsLoading(false);
      }
    }

    if (isLoggedIn && webId) {
      fetchStorages();
    } else {
      setIsLoading(false);
    }

    return () => {
      isMounted = false;
    };
  }, [isLoggedIn, webId]);

  return { storages, isLoading, error };
}
