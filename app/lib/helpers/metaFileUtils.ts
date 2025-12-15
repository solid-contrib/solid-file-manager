/**
 * Helper functions for working with .meta files in Solid
 * .meta files contain metadata about resources (like display names)
 * Uses LDO for parsing and serializing RDF data
 */

import { parseRdf, createLdoDataset, toTurtle } from "@ldo/ldo";
import { ResourceMetaShapeType } from "../../../src/ldo/Profile.shapeTypes";

/**
 * Get the .meta file URL for a given resource URL
 * For files: file.txt -> file.txt.meta
 * For containers: folder/ -> folder/.meta
 */
export function getMetaFileUrl(resourceUrl: string): string {
  return `${resourceUrl}.meta`;
}

/**
 * Fetch and parse the .meta file for a resource to get its display name
 * Uses LDO to parse the RDF content
 * Returns null if the .meta file doesn't exist or doesn't contain a name
 */
export async function getDisplayNameFromMeta(
  resourceUrl: string,
  fetchFn: typeof fetch
): Promise<string | null> {
  try {
    const metaFileUrl = getMetaFileUrl(resourceUrl);
    
    const response = await fetchFn(metaFileUrl, {
      headers: {
        'Accept': 'text/turtle',
      },
    });
    
    if (!response.ok) {
      return null;
    }
    
    const content = await response.text();
    
    // Parse with LDO
    const ldoDataset = await parseRdf(content, {
      baseIRI: metaFileUrl,
      format: "Turtle",
    });
    
    // Get metadata for the resource
    const meta = ldoDataset
      .usingType(ResourceMetaShapeType)
      .fromSubject(resourceUrl);

    // Check for dcterms:title first (title2 in generated types), then rdfs:label
    if (meta.title2) {
      return meta.title2;
    }

    if (meta.label) {
      return meta.label;
    }

    return null;
  } catch (error) {
    // .meta file doesn't exist or can't be read - this is normal
    return null;
  }
}

/**
 * Create or update a .meta file with the display name for a resource
 * Uses LDO to create the RDF and SPARQL UPDATE for patching
 */
export async function updateMetaFile(
  resourceUrl: string,
  displayName: string,
  fetchFn: typeof fetch
): Promise<void> {
  const metaFileUrl = getMetaFileUrl(resourceUrl);
  
  // Try to get existing .meta file content
  let existingContent: string | null = null;
  try {
    const response = await fetchFn(metaFileUrl, {
      headers: {
        'Accept': 'text/turtle',
      },
    });
    if (response.ok) {
      existingContent = await response.text();
    }
  } catch (error) {
    // .meta file doesn't exist yet, that's fine
  }

  // Build SPARQL UPDATE to set/update the display name
  // First, delete any existing title and label, then insert new ones
  const sparqlUpdate = `
    PREFIX dcterms: <http://purl.org/dc/terms/>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    
    DELETE {
      <${resourceUrl}> dcterms:title ?oldTitle .
      <${resourceUrl}> rdfs:label ?oldLabel .
    }
    WHERE {
      OPTIONAL { <${resourceUrl}> dcterms:title ?oldTitle . }
      OPTIONAL { <${resourceUrl}> rdfs:label ?oldLabel . }
    };
    
    INSERT DATA {
      <${resourceUrl}> dcterms:title "${escapeForSparql(displayName)}" .
      <${resourceUrl}> rdfs:label "${escapeForSparql(displayName)}" .
    }
  `;

  const patchResponse = await fetchFn(metaFileUrl, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/sparql-update',
    },
    body: sparqlUpdate,
  });

  if (!patchResponse.ok) {
    // If PATCH fails (e.g., file doesn't exist), try PUT with full content
    const ldoDataset = createLdoDataset();
    const meta = ldoDataset
      .usingType(ResourceMetaShapeType)
      .fromSubject(resourceUrl);
    
    meta.title2 = displayName;
    meta.label = displayName;
    
    const turtle = await toTurtle(meta);
    
    const putResponse = await fetchFn(metaFileUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'text/turtle',
      },
      body: turtle,
    });
    
    if (!putResponse.ok) {
      throw new Error(`Failed to update meta file: ${putResponse.statusText}`);
    }
  }
}

/**
 * Escape a string for use in a SPARQL literal
 */
function escapeForSparql(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}

