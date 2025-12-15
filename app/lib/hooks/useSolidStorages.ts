"use client";

import { useEffect, useState, useMemo } from "react";
import { useSolidAuth, useResource, useSubject } from "@ldo/solid-react";
import { parseRdf } from "@ldo/ldo";
import { namedNode } from "@ldo/rdf-utils";
import { SolidProfileShapeType, getStorageUrls } from "../helpers/profileUtils";

// Storage predicates and types (used for hierarchical traversal fallback)
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
        
        // Parse the RDF content using LDO
        let isStorage = false;
        
        if (contentType.includes('text/turtle') || contentType.includes('application/turtle') || 
            contentType.includes('text/n3') || contentType.includes('application/n3')) {
          try {
            const ldoDataset = await parseRdf(content, { baseIRI: currentUrl });
            
            // Check if this container is of type pim:Storage using dataset.match()
            const containerNode = namedNode(currentUrl);
            const rdfTypeNode = namedNode(RDF_TYPE);
            const pimStorageNode = namedNode(PIM_STORAGE_TYPE);
            const matchingQuads = ldoDataset.match(containerNode, rdfTypeNode, pimStorageNode);
            isStorage = matchingQuads.size > 0;
          } catch (e) {
            // Parse failed, continue to parent
          }
        } else {
          // Try parsing as Turtle anyway (some servers don't set content-type correctly)
          try {
            const ldoDataset = await parseRdf(content, { baseIRI: currentUrl });
            
            // Check if this container is of type pim:Storage using dataset.match()
            const containerNode = namedNode(currentUrl);
            const rdfTypeNode = namedNode(RDF_TYPE);
            const pimStorageNode = namedNode(PIM_STORAGE_TYPE);
            const matchingQuads = ldoDataset.match(containerNode, rdfTypeNode, pimStorageNode);
            isStorage = matchingQuads.size > 0;
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
 * 1. LDO's useResource and useSubject to discover storage locations via pim:storage and solid:storage predicates
 * 2. Hierarchical traversal to find pim:Storage containers by walking up the directory tree (fallback)
 */
export function useSolidStorages(): UseSolidStoragesResult {
  const { session } = useSolidAuth();
  const webId = session.webId;
  const [fallbackStorages, setFallbackStorages] = useState<string[]>([]);
  const [fallbackLoading, setFallbackLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  // useResource handles fetching automatically
  const resource = useResource(webId);
  
  // useSubject extracts typed data from the resource
  const profile = useSubject(SolidProfileShapeType, webId);
  
  // Check if resource is still loading
  const resourceIsLoading = resource ? (
    'isReading' in resource ? resource.isReading() : 
    'isUnfetched' in resource ? resource.isUnfetched() : 
    false
  ) : true;
  
  // Get storage URLs from profile using LDO
  const profileStorageUrls = useMemo(() => {
    if (!webId || !profile) {
      return [];
    }
    
    const baseUrl = webId.split('#')[0];
    const storageUrls: string[] = [];
    
    // Get storages from the profile using the helper function
    const profileStorages = getStorageUrls(profile);
    profileStorages.forEach(url => {
      const resolvedUrl = resolveStorageUrl(url, baseUrl);
      if (resolvedUrl && !storageUrls.includes(resolvedUrl)) {
        storageUrls.push(resolvedUrl);
      }
    });
    
    return storageUrls;
  }, [webId, profile]);
  
  // Fallback: Hierarchical traversal when no storage found in profile
  useEffect(() => {
    let isMounted = true;
    
    async function runFallback() {
      if (!webId || !session.isLoggedIn) return;
      
      // Only run fallback if profile is loaded and no storages found
      if (resourceIsLoading || profileStorageUrls.length > 0) return;
      
      setFallbackLoading(true);
      
      try {
        // Method 2: Hierarchical traversal (if no storage found via predicates)
        const fetchFn = ('fetch' in session && typeof (session as any).fetch === 'function') 
          ? (session as any).fetch 
          : fetch;
        const traversalStorages = await discoverStorageViaTraversal(webId, fetchFn);
        
        if (isMounted) {
          if (traversalStorages.length > 0) {
            setFallbackStorages(traversalStorages);
          } else {
            // If still no storage found, try to infer from WebID
            const webIdUrl = new URL(webId);
            const baseUrl = `${webIdUrl.protocol}//${webIdUrl.host}/`;
            setFallbackStorages([baseUrl]);
          }
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err : new Error("Failed to discover storage"));
        }
      } finally {
        if (isMounted) {
          setFallbackLoading(false);
        }
      }
    }
    
    runFallback();
    
    return () => {
      isMounted = false;
    };
  }, [webId, session.isLoggedIn, resourceIsLoading, profileStorageUrls.length]);
  
  // Combine profile storages with fallback storages
  const storages = useMemo<SolidStorage[]>(() => {
    const allUrls = profileStorageUrls.length > 0 ? profileStorageUrls : fallbackStorages;
    
    // Filter out invalid URLs
    const validStorageUrls = allUrls.filter(url => 
      url && 
      (url.startsWith('http://') || url.startsWith('https://')) &&
      !url.includes('undefined')
    );
    
    // Convert to SolidStorage format
    return validStorageUrls.map((url) => ({
      id: url,
      name: url,
      url: url,
    }));
  }, [profileStorageUrls, fallbackStorages]);
  
  // Determine loading state
  const isLoading = !session.isLoggedIn 
    ? false 
    : resourceIsLoading || fallbackLoading;
  
  // Handle resource error
  const resourceError = useMemo(() => {
    if (resource && 'isError' in resource && resource.isError) {
      return new Error("Failed to fetch profile for storage discovery");
    }
    return error;
  }, [resource, error]);

  return { storages, isLoading, error: resourceError };
}
