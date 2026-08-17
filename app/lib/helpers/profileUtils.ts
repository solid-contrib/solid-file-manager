import { Parser, Store, DataFactory } from "n3";
import { getSession } from "./sessionUtils";
import { WebIdDataset, type Agent } from "@solid/object/webid";

// Cache for parsed profile documents
const profileCache = new Map<string, Agent>();

/**
 * Fetches and parses the WebID profile document, with caching to avoid duplicate fetches
 * @param webId - The WebID to fetch
 * @returns The parsed RDF store, base URL, and main subject
 */
export async function fetchAndParseProfile(webId: string): Promise<Agent> {
  // Check cache first
  if (profileCache.has(webId)) {
    return profileCache.get(webId)!;
  }

  const session = getSession();
  const fetchFn = session.fetch || fetch;

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
      const response = await fetchFn(webId, {
        method: 'GET',
        headers: {
          'Accept': acceptHeader,
        },
      });

      if (response.ok) {
        contentType = response.headers.get('content-type') || '';
        content = await response.text();
        break;
      }
    } catch (err) {
      continue;
    }
  }

  if (!content) {
    throw new Error("Failed to fetch profile document with any Accept header");
  }

  // Parse the RDF content
  const store = new Store();
  const baseUrl = webId.split('#')[0];

  if (contentType.includes('text/turtle') || contentType.includes('application/turtle') ||
      contentType.includes('text/n3') || contentType.includes('application/n3')) {
    const parser = new Parser({ baseIRI: baseUrl });
    const quads = parser.parse(content);
    store.addQuads(quads);
  } else if (contentType.includes('application/ld+json')) {
    // Try parsing as Turtle anyway (most servers return Turtle even if JSON-LD is requested)
    try {
      const parser = new Parser({ baseIRI: baseUrl });
      const quads = parser.parse(content);
      store.addQuads(quads);
    } catch (e) {
      // Silent error handling
    }
  }

  const webIdDataset = new WebIdDataset(store, DataFactory);

  const mainSubject: Agent | undefined = webIdDataset.mainSubject;
  if (mainSubject === undefined) {
console.log("BOB")
      throw new Error; // TODO: Handle properly
  }

  // Cache the result
  profileCache.set(webId, mainSubject);

  return mainSubject;
}

/**
 * Clears the profile cache (useful for testing or when profile might have changed)
 */
export function clearProfileCache(webId?: string): void {
  if (webId) {
    profileCache.delete(webId);
  } else {
    profileCache.clear();
  }
}
