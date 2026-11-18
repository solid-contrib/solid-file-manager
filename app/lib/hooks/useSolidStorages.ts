"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSolidAuth } from "@ldo/solid-react";
import { Parser, Store, NamedNode } from "n3";
import { fetchAndParseProfile } from "../helpers/profileUtils";
import { useOwnServers, useSolidFetch } from "../../components/providers/SolidFetchProvider";
import { loadManualStorages, normaliseStorageUrl, saveManualStorage, storageProblem } from "../helpers/manualStorages";

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
  /** Adds a storage URL typed by the user, after checking they can open it. Resolves to an error message, or null. */
  addStorage: (input: string) => Promise<string | null>;
}

const toStorage = (url: string): SolidStorage => ({ id: url, name: url, url });

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
            // Move up one level and continue
            const parentUrl = currentUrl.substring(
              0,
              currentUrl.lastIndexOf("/", currentUrl.length - 2) + 1,
            );
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
  } catch {
    // Silent error handling
  }

  return storageUrls;
}

/**
 * Hook to fetch Solid storage roots from the user's WebID profile.
 * Uses two methods:
 * 1. Direct RDF parsing to discover storage locations via pim:storage and solid:storage predicates
 * 2. Hierarchical traversal to find pim:Storage containers by walking up the directory tree
 * plus any storage URLs the user added by hand (for servers whose profile lists
 * none, such as ESS 3 at the moment). It never guesses a storage from the WebID.
 */
export function useSolidStorages(): UseSolidStoragesResult {
  const { session } = useSolidAuth();
  const fetchFn = useSolidFetch();
  const ownServers = useOwnServers();
  const [storages, setStorages] = useState<SolidStorage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  // The WebID signed in right now, so a slow check can't add a storage to another account.
  const currentWebId = useRef(session.webId);
  currentWebId.current = session.isLoggedIn ? session.webId : undefined;
  // Registrations of storages added by hand (or being checked) while mounted;
  // they end with the hook, and a check still running then is dropped.
  const addedByHand = useRef(new Set<() => void>());
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    const added = addedByHand.current;
    return () => {
      mounted.current = false;
      added.forEach((release) => release());
      added.clear();
    };
  }, [ownServers]);

  useEffect(() => {
    let isMounted = true;
    // What this run registered, released again on cleanup.
    const registered: (() => void)[] = [];
    const register = (url: string, webId: string) => {
      if (isMounted) registered.push(ownServers.add(url, webId));
    };

    async function fetchStorages() {
      try {
        if (!isMounted) return;

        setIsLoading(true);
        setError(null);

        // Wait for authentication to complete
        if (!session.isLoggedIn || !session.webId) {
          setIsLoading(false);
          return;
        }

        const webId = session.webId;

        // Use shared profile fetching utility (with caching)
        const mainSubject = await fetchAndParseProfile(webId, fetchFn);

        // Get storage roots using both pim:storage and solid:storage predicates
        const storageUrls = new Set<string>(mainSubject.storageUrls);

        // Method 2: Hierarchical traversal (if no storage found via predicates)
        // Based on: https://github.com/SolidLabResearch/Bashlib/blob/80de25cbb4b3ed057f95e25bc057f1be9b00cef3/src/utils/util.ts#L73-L104
        if (storageUrls.size === 0) {
          try {
            const traversalStorages = await discoverStorageViaTraversal(
              webId,
              fetchFn,
            );
            traversalStorages.forEach((url) => {
              if (!storageUrls.has(url)) {
                storageUrls.add(url);
              }
            });
          } catch {
            // Silent error handling
          }
        }

        loadManualStorages(webId).forEach((url) => storageUrls.add(url));

        // Registered before anything can open them, so they get the user's login.
        storageUrls.forEach((url) => register(url, webId));
        if (isMounted) setStorages([...storageUrls].map(toStorage));
      } catch (err) {
        // Storages the user added by hand don't depend on the profile, so a
        // failed discovery still shows them rather than an error.
        const manual = session.webId ? loadManualStorages(session.webId) : [];
        if (manual.length > 0) {
          manual.forEach((url) => register(url, session.webId!));
          setStorages(manual.map(toStorage));
        } else {
          setError(err instanceof Error ? err : new Error("Failed to fetch storage roots"));
          setStorages([]);
        }
      } finally {
        setIsLoading(false);
      }
    }

    if (session.isLoggedIn && session.webId) {
      fetchStorages();
    } else {
      setIsLoading(false);
    }

    return () => {
      isMounted = false;
      registered.forEach((release) => release());
    };
  }, [session.isLoggedIn, session.webId, fetchFn, ownServers]);

  const addStorage = useCallback(
    async (input: string): Promise<string | null> => {
      const webId = session.webId;
      if (!webId) return "You are not signed in.";
      const normalised = normaliseStorageUrl(input);
      if ("error" in normalised) return normalised.error;
      // The user chose this storage, so its server may get their login, but
      // only for as long as it checks out.
      const release = ownServers.add(normalised.url, webId);
      addedByHand.current.add(release);
      let problem: string | null;
      try {
        problem = storageProblem(await fetchFn(normalised.url, { headers: { Accept: "text/turtle" } }));
      } catch {
        problem = "Couldn't reach that storage. Check the URL and try again.";
      }
      if (!mounted.current) return "Cancelled."; // cleanup already removed the registration
      if (!problem && currentWebId.current !== webId) problem = "You signed in as someone else; please try again.";
      release();
      addedByHand.current.delete(release);
      if (problem) return problem;
      // Registered afresh, in case a logout cleared the check's registration meanwhile.
      addedByHand.current.add(ownServers.add(normalised.url, webId));
      const urls = saveManualStorage(webId, normalised.url);
      setStorages((current) => {
        const known = new Set(current.map((storage) => storage.url));
        return [...current, ...urls.filter((url) => !known.has(url)).map(toStorage)];
      });
      return null;
    },
    [session.webId, fetchFn, ownServers],
  );

  return { storages, isLoading, error, addStorage };
}
