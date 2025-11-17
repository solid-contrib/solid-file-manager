/**
 * Helper functions for working with .meta files in Solid
 * .meta files contain metadata about resources (like display names)
 */

import {
  UrlString,
  getSolidDataset,
  getThing,
  getStringNoLocale,
  createThing,
  setThing,
  setStringNoLocale,
  saveSolidDatasetAt,
  createSolidDataset,
} from "@inrupt/solid-client";
import { DCTERMS, RDFS } from "@inrupt/vocab-common-rdf";

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
 * Returns null if the .meta file doesn't exist or doesn't contain a name
 */
export async function getDisplayNameFromMeta(
  resourceUrl: string,
  fetchFn: typeof fetch
): Promise<string | null> {
  try {
    const metaFileUrl = getMetaFileUrl(resourceUrl);
    const metaDataset = await getSolidDataset(metaFileUrl as UrlString, { fetch: fetchFn });
    
    // The .meta file describes the resource, so the subject is the resource URL
    const thing = getThing(metaDataset, resourceUrl);
    if (!thing) {
      return null;
    }

    // Check for dcterms:title first, then rdfs:label
    const title = getStringNoLocale(thing, DCTERMS.title);
    if (title) {
      return title;
    }

    const label = getStringNoLocale(thing, RDFS.label);
    if (label) {
      return label;
    }

    return null;
  } catch (error) {
    // .meta file doesn't exist or can't be read - this is normal
    return null;
  }
}

/**
 * Create or update a .meta file with the display name for a resource
 * Uses PATCH (via saveSolidDatasetAt) as required by the server
 */
export async function updateMetaFile(
  resourceUrl: string,
  displayName: string,
  fetchFn: typeof fetch
): Promise<void> {
  const metaFileUrl = getMetaFileUrl(resourceUrl) as UrlString;
  
  // Try to get existing .meta file, or create a new dataset
  let dataset;
  try {
    dataset = await getSolidDataset(metaFileUrl, { fetch: fetchFn });
  } catch (error) {
    // .meta file doesn't exist yet, create a new dataset
    dataset = createSolidDataset();
  }

  // Get or create the thing for the resource
  let thing = getThing(dataset, resourceUrl);
  if (!thing) {
    thing = createThing({ url: resourceUrl as UrlString });
  }

  // Set the display name using dcterms:title and rdfs:label
  thing = setStringNoLocale(thing, DCTERMS.title, displayName);
  thing = setStringNoLocale(thing, RDFS.label, displayName);

  // Update the dataset with the modified thing
  const updatedDataset = setThing(dataset, thing);

  // Use saveSolidDatasetAt which uses PATCH internally
  await saveSolidDatasetAt(metaFileUrl, updatedDataset, { fetch: fetchFn });
}

