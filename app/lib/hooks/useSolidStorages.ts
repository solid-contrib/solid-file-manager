"use client";

import { useEffect, useState } from "react";
import { getDefaultSession } from "@inrupt/solid-client-authn-browser";
import { Parser, Store, NamedNode, Literal } from "n3";
import { fetchAndParseProfile } from "../helpers/profileUtils";

// Storage predicates and types
const PIM_STORAGE = "http://www.w3.org/ns/pim/space#storage";
const SOLID_STORAGE = "http://www.w3.org/ns/solid/terms#storage";
const PIM_STORAGE_TYPE = "http://www.w3.org/ns/pim/space#Storage";
const RDF_TYPE = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";
const FOAF_NAME = "http://xmlns.com/foaf/0.1/name";
const VCARD_FN = "http://www.w3.org/2006/vcard/ns#fn";

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
 * Resolves and normalizes a storage URL, handling relative URLs, undefined prefixes, etc.
 * @param {string} storageUrl - The storage URL to resolve
 * @param {string} baseUrl - The base URL to resolve relative URLs against
 * @returns {string | null} - The resolved absolute URL, or null if invalid
 */
function resolveStorageUrl(storageUrl: string, baseUrl: string): string | null {
  // Handle the case where n3 parser didn't resolve the prefix correctly
  // "pre:" prefix resolves to "</.>" which should be the root "/"
  if (storageUrl === 'undefined/' || storageUrl.includes('undefined')) {
    const baseUrlObj = new URL(baseUrl);
    return `${baseUrlObj.protocol}//${baseUrlObj.host}/`;
  }

  // Handle relative URLs that end with "/." or are just "/"
  if (storageUrl.endsWith('/.') || storageUrl.endsWith('/./') || 
      storageUrl === './' || storageUrl === '/' || 
      (storageUrl.startsWith('/') && !storageUrl.startsWith('http'))) {
    const baseUrlObj = new URL(baseUrl);
    if (storageUrl.endsWith('/.') || storageUrl === './' || storageUrl === '/') {
      return `${baseUrlObj.protocol}//${baseUrlObj.host}/`;
    } else {
      // Handle paths like "/path" -> "https://domain.com/path"
      try {
        return new URL(storageUrl, baseUrl).href;
      } catch (e) {
        // If URL construction fails, try manual resolution
        if (storageUrl.startsWith('/')) {
          return `${baseUrlObj.protocol}//${baseUrlObj.host}${storageUrl}`;
        }
      }
    }
  }

  // Also check if it's a relative URL without protocol
  if (!storageUrl.startsWith('http://') && !storageUrl.startsWith('https://')) {
    try {
      const baseUrlObj = new URL(baseUrl);
      if (storageUrl.startsWith('/')) {
        return `${baseUrlObj.protocol}//${baseUrlObj.host}${storageUrl}`;
      } else {
        return new URL(storageUrl, baseUrl).href;
      }
    } catch (e) {
      // Silent error handling
      return null;
    }
  }

  // Final validation - ensure it's a valid absolute URL
  if (storageUrl && storageUrl.startsWith('http')) {
    return storageUrl;
  }

  return null;
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
  fetchFn: typeof fetch
): Promise<string[]> {
  const storageUrls: string[] = [];
  
  try {
    // Extract the base URL from the WebID (remove fragment)
    const url = new URL(webId);
    const baseUrl = `${url.origin}${url.pathname}`;
    
    // Start from the parent directory of the WebID
    let currentUrl = baseUrl.substring(0, baseUrl.lastIndexOf('/') + 1);
    
    // Traverse up the hierarchy
    const maxLevels = 10; // Prevent infinite loops
    let level = 0;
    
    while (currentUrl && level < maxLevels) {
      try {
        // Fetch the container with content negotiation
        const response = await fetchFn(currentUrl, {
          method: 'GET',
          headers: {
            'Accept': 'text/turtle, application/ld+json, */*;q=0.1',
          },
        });
        
        if (!response.ok) {
          // Move up one level and continue
          const parentUrl = currentUrl.substring(0, currentUrl.lastIndexOf('/', currentUrl.length - 2) + 1);
          if (parentUrl === currentUrl || parentUrl === `${url.origin}/`) {
            break; // Reached root
          }
          currentUrl = parentUrl;
          level++;
          continue;
        }
        
        const contentType = response.headers.get('Content-Type') || '';
        const content = await response.text();
        
        // Parse the RDF content
        const store = new Store();
        if (contentType.includes('text/turtle') || contentType.includes('application/turtle') || 
            contentType.includes('text/n3') || contentType.includes('application/n3')) {
          const parser = new Parser({ baseIRI: currentUrl });
          const quads = parser.parse(content);
          store.addQuads(quads);
        } else {
          // Try parsing as Turtle anyway (some servers don't set content-type correctly)
          try {
            const parser = new Parser({ baseIRI: currentUrl });
            const quads = parser.parse(content);
            store.addQuads(quads);
          } catch (e) {
            // Move up one level and continue
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
        const typeQuads = store.getQuads(containerNode, rdfType, pimStorageType, null);
        const isStorage = typeQuads.length > 0;
        
        if (isStorage) {
          // Ensure URL ends with /
          const storageUrl = currentUrl.endsWith('/') ? currentUrl : currentUrl + '/';
          storageUrls.push(storageUrl);
          break; // Found storage, no need to continue
        }
        
        // Move up one level
        const parentUrl = currentUrl.substring(0, currentUrl.lastIndexOf('/', currentUrl.length - 2) + 1);
        if (parentUrl === currentUrl || parentUrl === `${url.origin}/`) {
          break; // Reached root
        }
        currentUrl = parentUrl;
        level++;
      } catch (error) {
        // If we can't fetch a container, try the parent
        const parentUrl = currentUrl.substring(0, currentUrl.lastIndexOf('/', currentUrl.length - 2) + 1);
        if (parentUrl === currentUrl || parentUrl === `${url.origin}/`) {
          break;
        }
        currentUrl = parentUrl;
        level++;
      }
    }
  } catch (error) {
    // Silent error handling
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
  const [storages, setStorages] = useState<SolidStorage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let isMounted = true;
    let checkInterval: NodeJS.Timeout | null = null;
    
    async function fetchStorages() {
      try {
        if (!isMounted) return;
        
        setIsLoading(true);
        setError(null);

        const session = getDefaultSession();
        
        // Wait a bit for authentication to complete
        if (!session.info.isLoggedIn || !session.info.webId) {
          // Set up a polling mechanism to check when authentication completes
          // Keep isLoading as true while waiting for authentication
          checkInterval = setInterval(() => {
            if (!isMounted) {
              if (checkInterval) clearInterval(checkInterval);
              return;
            }
            
            const currentSession = getDefaultSession();
            if (currentSession.info.isLoggedIn && currentSession.info.webId) {
              if (checkInterval) clearInterval(checkInterval);
              // Trigger re-fetch by calling fetchStorages again
              fetchStorages();
            }
          }, 500);
          
          // Clear interval after 10 seconds to avoid infinite polling
          setTimeout(() => {
            if (checkInterval) {
              clearInterval(checkInterval);
              checkInterval = null;
            }
            // Only set loading to false if we've given up waiting and component is still mounted
            if (isMounted) {
              const finalSession = getDefaultSession();
              if (!finalSession.info.isLoggedIn || !finalSession.info.webId) {
                setIsLoading(false);
              }
            }
          }, 10000);
          
          // Don't set isLoading to false here - keep it true while waiting
          return;
        }

        const webId = session.info.webId;

        // Use shared profile fetching utility (with caching)
        const { store, baseUrl, mainSubject } = await fetchAndParseProfile(webId);


        // Get storage roots using both pim:storage and solid:storage predicates
        const storageUrls: string[] = [];
        
        // Try pim:storage
        const pimStorageQuads = store.getQuads(mainSubject, new NamedNode(PIM_STORAGE), null, null);
      
        pimStorageQuads.forEach(quad => {
          if (quad.object instanceof NamedNode) {
            const resolvedUrl = resolveStorageUrl(quad.object.value, baseUrl);
            if (resolvedUrl && !storageUrls.includes(resolvedUrl)) {
              storageUrls.push(resolvedUrl);
            }
          }
        });

        // Try solid:storage
        const solidStorageQuads = store.getQuads(mainSubject, new NamedNode(SOLID_STORAGE), null, null);
        solidStorageQuads.forEach(quad => {
          if (quad.object instanceof NamedNode) {
            const storageUrl = quad.object.value;
            if (!storageUrls.includes(storageUrl)) {
              storageUrls.push(storageUrl);
            }
          }
        });

        // Also check all quads in the store for storage predicates (in case subject is different)
        const allPimStorageQuads = store.getQuads(null, new NamedNode(PIM_STORAGE), null, null);
        allPimStorageQuads.forEach(quad => {
          if (quad.object instanceof NamedNode) {
            const resolvedUrl = resolveStorageUrl(quad.object.value, baseUrl);
            if (resolvedUrl && !storageUrls.includes(resolvedUrl)) {
              storageUrls.push(resolvedUrl);
            }
          } else if (quad.object instanceof Literal) {
            // Sometimes storage might be a literal, try to resolve it
            const resolvedUrl = resolveStorageUrl(quad.object.value, baseUrl);
            if (resolvedUrl && !storageUrls.includes(resolvedUrl)) {
              storageUrls.push(resolvedUrl);
            }
          }
        });

        const allSolidStorageQuads = store.getQuads(null, new NamedNode(SOLID_STORAGE), null, null);
        allSolidStorageQuads.forEach(quad => {
          if (quad.object instanceof NamedNode) {
            const storageUrl = quad.object.value;
            if (!storageUrls.includes(storageUrl)) {
              storageUrls.push(storageUrl);
            }
          }
        });

        // Method 2: Hierarchical traversal (if no storage found via predicates)
        // Based on: https://github.com/SolidLabResearch/Bashlib/blob/80de25cbb4b3ed057f95e25bc057f1be9b00cef3/src/utils/util.ts#L73-L104
        if (storageUrls.length === 0) {
          try {
            const traversalStorages = await discoverStorageViaTraversal(webId, session.fetch || fetch);
            traversalStorages.forEach(url => {
              if (!storageUrls.includes(url)) {
                storageUrls.push(url);
              }
            });
          } catch (err) {
            // Silent error handling
          }
        }

        // If still no storage found, try to infer from WebID
        if (storageUrls.length === 0) {
          // Extract base URL from WebID
          const webIdUrl = new URL(webId);
          const baseUrl = `${webIdUrl.protocol}//${webIdUrl.host}/`;
          
          // For solidcommunity.net, storage is typically at the root
          if (webId.includes("solidcommunity.net")) {
            storageUrls.push(baseUrl);
          } else {
            // For other providers, try common patterns
            storageUrls.push(baseUrl);
          }
        }

        // Filter out invalid URLs (those with "undefined" or not starting with http)
        const validStorageUrls = storageUrls.filter(url => 
          url && 
          (url.startsWith('http://') || url.startsWith('https://')) &&
          !url.includes('undefined')
        );

        // Convert to SolidStorage format
        const discoveredStorages: SolidStorage[] = validStorageUrls.map((url) => {
          return {
            id: url,
            name: url,
            url: url,
          };
        });

        setStorages(discoveredStorages);
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err : new Error("Failed to fetch storage roots");
        setError(errorMessage);
        setStorages([]);
      } finally {
        setIsLoading(false);
      }
    }

    fetchStorages();
    
    // Also set up a listener for session changes
    const checkSession = setInterval(() => {
      if (!isMounted) {
        clearInterval(checkSession);
        return;
      }
      
      const session = getDefaultSession();
      if (session.info.isLoggedIn && session.info.webId && storages.length === 0 && !isLoading) {
        fetchStorages();
      }
    }, 1000);
    
    return () => {
      isMounted = false;
      if (checkInterval) clearInterval(checkInterval);
      clearInterval(checkSession);
    };
  }, []);

  return { storages, isLoading, error };
}
