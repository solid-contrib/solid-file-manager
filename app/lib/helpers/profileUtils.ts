import { Parser, Store, NamedNode } from "n3";
import { getSession } from "./sessionUtils";

// Cache for parsed profile documents
const profileCache = new Map<string, { store: Store; baseUrl: string; mainSubject: NamedNode }>();

/**
 * Fetches and parses the WebID profile document, with caching to avoid duplicate fetches
 * @param webId - The WebID to fetch
 * @returns The parsed RDF store, base URL, and main subject
 */
export async function fetchAndParseProfile(
  webId: string
): Promise<{ store: Store; baseUrl: string; mainSubject: NamedNode }> {
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

  // Find the main subject - try different variants
  const FOAF_NAME = "http://xmlns.com/foaf/0.1/name";
  const subjectVariants = [
    new NamedNode(webId),
    new NamedNode(baseUrl + '#me'),
    new NamedNode('#me'),
    new NamedNode(baseUrl + '#card'),
  ];

  let mainSubject: NamedNode | null = null;

  for (const subject of subjectVariants) {
    const nameQuads = store.getQuads(subject, new NamedNode(FOAF_NAME), null, null);
    if (nameQuads.length > 0) {
      mainSubject = subject;
      break;
    }
  }

  // If still not found, try to find Person type
  if (!mainSubject) {
    const personType = new NamedNode('http://xmlns.com/foaf/0.1/Person');
    const personQuads = store.getQuads(null, new NamedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'), personType, null);
    if (personQuads.length > 0 && personQuads[0].subject.termType === 'NamedNode') {
      mainSubject = personQuads[0].subject as NamedNode;
    }
  }

  // Fallback to WebID itself
  if (!mainSubject) {
    mainSubject = new NamedNode(webId);
  }

  // Cache the result
  const result = { store, baseUrl, mainSubject };
  profileCache.set(webId, result);

  return result;
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

