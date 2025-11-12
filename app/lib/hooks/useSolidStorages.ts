"use client";

import { useEffect, useState } from "react";
import { getDefaultSession } from "@inrupt/solid-client-authn-browser";
import { Parser, Store, NamedNode, Literal } from "n3";

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
        console.log(`[Traversal] Checking container: ${currentUrl}`);
        
        // Fetch the container with content negotiation
        const response = await fetchFn(currentUrl, {
          method: 'GET',
          headers: {
            'Accept': 'text/turtle, application/ld+json, */*;q=0.1',
          },
        });
        
        if (!response.ok) {
          console.log(`[Traversal] Container not accessible: ${response.status} ${response.statusText}`);
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
            console.warn(`[Traversal] Failed to parse content from ${currentUrl}:`, e);
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
          console.log(`[Traversal] Found pim:Storage at: ${storageUrl}`);
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
        console.debug(`[Traversal] Could not fetch ${currentUrl}, trying parent:`, error);
        const parentUrl = currentUrl.substring(0, currentUrl.lastIndexOf('/', currentUrl.length - 2) + 1);
        if (parentUrl === currentUrl || parentUrl === `${url.origin}/`) {
          break;
        }
        currentUrl = parentUrl;
        level++;
      }
    }
  } catch (error) {
    console.error("[Traversal] Error discovering storage via traversal:", error);
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
          console.log("=== Storage Discovery ===");
          console.log("User not logged in or WebID not available");
          console.log("Session:", session.info);
          console.log("Waiting for authentication...");
          console.log("=========================");
          
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
        console.log("=== Storage Discovery ===");
        console.log("WebID:", webId);
        console.log("Fetching profile document...");

        // Try different Accept headers to get the profile
        const acceptHeaders = [
          'text/turtle, application/turtle, text/n3, application/n3',
          'text/turtle',
          'application/ld+json',
        ];

        let content: string | null = null;
        let contentType: string = '';

        for (const acceptHeader of acceptHeaders) {
          try {
            console.log(`Trying Accept header: ${acceptHeader}`);
            // Always use the authenticated session's fetch function
            const fetchFn = session.fetch || fetch;
            const response = await fetchFn(webId, {
              method: 'GET',
              headers: {
                'Accept': acceptHeader,
              },
            });

            if (response.ok) {
              contentType = response.headers.get('content-type') || '';
              content = await response.text();
              console.log(`Successfully fetched profile with content-type: ${contentType}`);
              console.log(`Content length: ${content.length} characters`);
              console.log(`\n=== Raw Profile Content (Full) ===`);
              console.log(content);
              console.log(`\n=== End of Raw Content ===`);
              break;
            } else {
              console.log(`Failed with status ${response.status} for Accept: ${acceptHeader}`);
            }
          } catch (err) {
            console.log(`Error with Accept header ${acceptHeader}:`, err);
            continue;
          }
        }

        if (!content) {
          throw new Error("Failed to fetch profile document with any Accept header");
        }

        // Parse the RDF content
        const store = new Store();
        
        if (contentType.includes('text/turtle') || contentType.includes('application/turtle') || 
            contentType.includes('text/n3') || contentType.includes('application/n3')) {
          console.log("Parsing as Turtle/N3...");
          const parser = new Parser();
          const quads = parser.parse(content);
          store.addQuads(quads);
          console.log(`Parsed ${quads.length} quads from Turtle`);
        } else if (contentType.includes('application/ld+json')) {
          console.log("Parsing as JSON-LD...");
          // For JSON-LD, we'd need a different parser, but for now let's try to extract from Turtle
          // Most Solid servers return Turtle even if JSON-LD is requested
          try {
            const parser = new Parser();
            const quads = parser.parse(content);
            store.addQuads(quads);
            console.log(`Parsed ${quads.length} quads from JSON-LD (as Turtle)`);
          } catch (e) {
            console.warn("Failed to parse as Turtle, might be actual JSON-LD:", e);
            // TODO: Add JSON-LD parsing if needed
          }
        }

        // Find the main subject - try different variants
        const baseUrl = webId.split('#')[0];
        const subjectVariants = [
          new NamedNode(webId),
          new NamedNode(baseUrl + '#me'),
          new NamedNode('#me'),
          new NamedNode(baseUrl + '#card'),
        ];

        console.log("Looking for main subject with variants:", subjectVariants.map(s => s.value));

        // Find the main subject by looking for common profile properties
        let mainSubject: NamedNode | null = null;
        
        for (const subject of subjectVariants) {
          const nameQuads = store.getQuads(subject, new NamedNode(FOAF_NAME), null, null);
          if (nameQuads.length > 0) {
            mainSubject = subject;
            console.log(`Found main subject: ${subject.value} (via FOAF name)`);
            break;
          }
        }

        // If still not found, try to find Person type
        if (!mainSubject) {
          const personType = new NamedNode('http://xmlns.com/foaf/0.1/Person');
          const personQuads = store.getQuads(null, new NamedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'), personType, null);
          if (personQuads.length > 0 && personQuads[0].subject.termType === 'NamedNode') {
            mainSubject = personQuads[0].subject as NamedNode;
            console.log(`Found main subject: ${mainSubject.value} (via Person type)`);
          }
        }

        // Fallback to WebID itself
        if (!mainSubject) {
          mainSubject = new NamedNode(webId);
          console.log(`Using WebID as main subject: ${webId}`);
        }

        // Get profile name
        const getName = (subject: NamedNode): string | null => {
          const nameQuads = store.getQuads(subject, new NamedNode(FOAF_NAME), null, null);
          if (nameQuads.length > 0 && nameQuads[0].object instanceof Literal) {
            return nameQuads[0].object.value;
          }
          const vcardQuads = store.getQuads(subject, new NamedNode(VCARD_FN), null, null);
          if (vcardQuads.length > 0 && vcardQuads[0].object instanceof Literal) {
            return vcardQuads[0].object.value;
          }
          return null;
        };

        const profileName = getName(mainSubject) || 
                           webId.split("/").pop()?.split("#")[0] || 
                           "My Storage";
        
        console.log("Profile name:", profileName);

        // Get storage roots using both pim:storage and solid:storage predicates
        const storageUrls: string[] = [];
        
        // Try pim:storage
        const pimStorageQuads = store.getQuads(mainSubject, new NamedNode(PIM_STORAGE), null, null);
        console.log(`Found ${pimStorageQuads.length} pim:storage quads`);
        pimStorageQuads.forEach(quad => {
          if (quad.object instanceof NamedNode) {
            let storageUrl = quad.object.value;
            const originalValue = storageUrl;
            
            // Handle the case where n3 parser didn't resolve the prefix correctly
            // "pre:" prefix resolves to "</.>" which should be the root "/"
            if (storageUrl === 'undefined/' || storageUrl.includes('undefined')) {
              const baseUrlObj = new URL(baseUrl);
              storageUrl = `${baseUrlObj.protocol}//${baseUrlObj.host}/`;
              console.log(`Fixed undefined prefix: ${originalValue} -> ${storageUrl}`);
            } else if (!storageUrl.startsWith('http://') && !storageUrl.startsWith('https://')) {
              // Resolve relative URLs
              const baseUrlObj = new URL(baseUrl);
              if (storageUrl === './' || storageUrl === '/' || storageUrl.endsWith('/.')) {
                storageUrl = `${baseUrlObj.protocol}//${baseUrlObj.host}/`;
              } else {
                storageUrl = new URL(storageUrl, baseUrl).href;
              }
              console.log(`Resolved relative storage URL: ${originalValue} -> ${storageUrl}`);
            }
            
            if (storageUrl && storageUrl.startsWith('http') && !storageUrls.includes(storageUrl)) {
              storageUrls.push(storageUrl);
              console.log("Found storage via pim:storage:", storageUrl);
            }
          }
        });

        // Try solid:storage
        const solidStorageQuads = store.getQuads(mainSubject, new NamedNode(SOLID_STORAGE), null, null);
        console.log(`Found ${solidStorageQuads.length} solid:storage quads`);
        solidStorageQuads.forEach(quad => {
          if (quad.object instanceof NamedNode) {
            const storageUrl = quad.object.value;
            if (!storageUrls.includes(storageUrl)) {
              storageUrls.push(storageUrl);
              console.log("Found storage via solid:storage:", storageUrl);
            }
          }
        });

        // Also check all quads in the store for storage predicates (in case subject is different)
        const allPimStorageQuads = store.getQuads(null, new NamedNode(PIM_STORAGE), null, null);
        console.log(`Found ${allPimStorageQuads.length} total pim:storage quads in store`);
        allPimStorageQuads.forEach(quad => {
          if (quad.object instanceof NamedNode) {
            let storageUrl = quad.object.value;
            const originalValue = storageUrl;
            
            console.log(`Processing storage URL: ${storageUrl} (original: ${originalValue})`);
            
            // Handle the case where n3 parser didn't resolve the prefix correctly
            // "pre:" prefix resolves to "</.>" which should be the root "/"
            // If we see "undefined/" it means the prefix wasn't resolved
            if (storageUrl === 'undefined/' || storageUrl.includes('undefined')) {
              // The prefix "pre:" resolves to "</.>" which is the root
              const baseUrlObj = new URL(baseUrl);
              storageUrl = `${baseUrlObj.protocol}//${baseUrlObj.host}/`;
              console.log(`Fixed undefined prefix: ${originalValue} -> ${storageUrl}`);
            }
            // Handle relative URLs that end with "/." or are just "/"
            else if (storageUrl.endsWith('/.') || storageUrl.endsWith('/./') || 
                     storageUrl === './' || storageUrl === '/' || 
                     (storageUrl.startsWith('/') && !storageUrl.startsWith('http'))) {
              // Resolve relative URL to absolute
              const baseUrlObj = new URL(baseUrl);
              if (storageUrl.endsWith('/.') || storageUrl === './' || storageUrl === '/') {
                storageUrl = `${baseUrlObj.protocol}//${baseUrlObj.host}/`;
              } else {
                // Handle paths like "/path" -> "https://domain.com/path"
                try {
                  storageUrl = new URL(storageUrl, baseUrl).href;
                } catch (e) {
                  // If URL construction fails, try manual resolution
                  if (storageUrl.startsWith('/')) {
                    storageUrl = `${baseUrlObj.protocol}//${baseUrlObj.host}${storageUrl}`;
                  }
                }
              }
              console.log(`Resolved relative storage URL: ${originalValue} -> ${storageUrl}`);
            }
            // Also check if it's a relative URL without protocol
            else if (!storageUrl.startsWith('http://') && !storageUrl.startsWith('https://')) {
              try {
                const baseUrlObj = new URL(baseUrl);
                if (storageUrl.startsWith('/')) {
                  storageUrl = `${baseUrlObj.protocol}//${baseUrlObj.host}${storageUrl}`;
                } else {
                  storageUrl = new URL(storageUrl, baseUrl).href;
                }
                console.log(`Resolved non-absolute storage URL: ${originalValue} -> ${storageUrl}`);
              } catch (e) {
                console.warn(`Failed to resolve storage URL: ${originalValue}`, e);
              }
            }
            
            // Final validation - ensure it's a valid absolute URL
            if (storageUrl && storageUrl.startsWith('http')) {
              if (!storageUrls.includes(storageUrl)) {
                storageUrls.push(storageUrl);
                console.log("Found storage via pim:storage (from any subject):", storageUrl);
              }
            } else {
              console.warn(`Skipping invalid storage URL: ${storageUrl}`);
            }
          } else if (quad.object instanceof Literal) {
            // Sometimes storage might be a literal, try to resolve it
            const storageValue = quad.object.value;
            if (storageValue === './' || storageValue === '/' || storageValue.startsWith('/')) {
              const baseUrlObj = new URL(baseUrl);
              const resolvedUrl = storageValue === './' || storageValue === '/' 
                ? `${baseUrlObj.protocol}//${baseUrlObj.host}/`
                : new URL(storageValue, baseUrl).href;
              if (!storageUrls.includes(resolvedUrl)) {
                storageUrls.push(resolvedUrl);
                console.log("Found storage via pim:storage (literal, resolved):", resolvedUrl);
              }
            }
          }
        });

        const allSolidStorageQuads = store.getQuads(null, new NamedNode(SOLID_STORAGE), null, null);
        console.log(`Found ${allSolidStorageQuads.length} total solid:storage quads in store`);
        allSolidStorageQuads.forEach(quad => {
          if (quad.object instanceof NamedNode) {
            const storageUrl = quad.object.value;
            if (!storageUrls.includes(storageUrl)) {
              storageUrls.push(storageUrl);
              console.log("Found storage via solid:storage (from any subject):", storageUrl);
            }
          }
        });

        // Log all quads for debugging
        console.log("=== All Quads in Store ===");
        const allQuads = store.getQuads(null, null, null, null);
        console.log(`Total quads: ${allQuads.length}`);
        
        // Group quads by subject for better readability
        const quadsBySubject = new Map<string, Array<{ predicate: string; object: string; objectType: string }>>();
        
        allQuads.forEach(quad => {
          const subject = quad.subject.value;
          if (!quadsBySubject.has(subject)) {
            quadsBySubject.set(subject, []);
          }
          quadsBySubject.get(subject)!.push({
            predicate: quad.predicate.value,
            object: quad.object instanceof NamedNode ? quad.object.value : 
                   quad.object instanceof Literal ? quad.object.value : 
                   quad.object.value,
            objectType: quad.object.termType,
          });
        });
        
        console.log(`Found ${quadsBySubject.size} unique subjects`);
        console.log("\n=== Quads Grouped by Subject ===");
        quadsBySubject.forEach((quads, subject) => {
          console.log(`\nSubject: ${subject}`);
          quads.forEach(quad => {
            console.log(`  ${quad.predicate}`);
            console.log(`    -> ${quad.object} (${quad.objectType})`);
          });
        });
        
        // Also log all quads in a flat list
        console.log("\n=== All Quads (Flat List) ===");
        allQuads.forEach((quad, idx) => {
          const objectValue = quad.object instanceof NamedNode ? quad.object.value : 
                             quad.object instanceof Literal ? quad.object.value : 
                             quad.object.value;
          console.log(`Quad ${idx + 1}:`, {
            subject: quad.subject.value,
            predicate: quad.predicate.value,
            object: objectValue,
            objectType: quad.object.termType,
          });
        });
        console.log("=========================");

        // Method 2: Hierarchical traversal (if no storage found via predicates)
        // Based on: https://github.com/SolidLabResearch/Bashlib/blob/80de25cbb4b3ed057f95e25bc057f1be9b00cef3/src/utils/util.ts#L73-L104
        if (storageUrls.length === 0) {
          console.log("No storage found via predicates, attempting hierarchical traversal...");
          
          try {
            const traversalStorages = await discoverStorageViaTraversal(webId, session.fetch || fetch);
            traversalStorages.forEach(url => {
              if (!storageUrls.includes(url)) {
                storageUrls.push(url);
                console.log("Found storage via hierarchical traversal:", url);
              }
            });
          } catch (err) {
            console.warn("Hierarchical traversal failed:", err);
          }
        }

        // If still no storage found, try to infer from WebID
        if (storageUrls.length === 0) {
          console.log("No storage found via predicates or traversal, attempting to infer from WebID...");
          
          // Extract base URL from WebID
          const webIdUrl = new URL(webId);
          const baseUrl = `${webIdUrl.protocol}//${webIdUrl.host}/`;
          
          // For solidcommunity.net, storage is typically at the root
          if (webId.includes("solidcommunity.net")) {
            storageUrls.push(baseUrl);
            console.log("Inferred storage from solidcommunity.net:", baseUrl);
          } else {
            // For other providers, try common patterns
            storageUrls.push(baseUrl);
            console.log("Inferred storage from WebID base URL:", baseUrl);
          }
        }

        // Filter out invalid URLs (those with "undefined" or not starting with http)
        const validStorageUrls = storageUrls.filter(url => 
          url && 
          (url.startsWith('http://') || url.startsWith('https://')) &&
          !url.includes('undefined')
        );
        
        console.log("All discovered storage URLs (before filtering):", storageUrls);
        console.log("Valid storage URLs (after filtering):", validStorageUrls);

        // Convert to SolidStorage format
        const discoveredStorages: SolidStorage[] = validStorageUrls.map((url, index) => {
          return {
            id: url,
            name: index === 0 ? profileName : `${profileName} (${index + 1})`,
            url: url,
          };
        });

        console.log("Discovered storages:", discoveredStorages);
        console.log("=========================");

        setStorages(discoveredStorages);
      } catch (err) {
        console.error("Error fetching storages:", err);
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
        console.log("Session state changed, re-fetching storages...");
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
