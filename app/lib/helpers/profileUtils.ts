/**
 * Profile utilities for working with Solid Profile data via LDO
 * 
 * This module provides helper functions for extracting data from SolidProfile objects.
 * Fetching is handled by LDO's useResource and useSubject hooks in React components.
 * For on-demand fetching (e.g., in event handlers), use fetchProfileOnDemand.
 */

import { parseRdf } from "@ldo/ldo";
import { SolidProfile } from "../../../src/ldo/Profile.typings";
import { SolidProfileShapeType as ProfileShapeType } from "../../../src/ldo/Profile.shapeTypes";

// Re-export shape type for convenience
export { SolidProfileShapeType } from "../../../src/ldo/Profile.shapeTypes";

// Re-export types for convenience
export type { SolidProfile } from "../../../src/ldo/Profile.typings";

/**
 * Fetches and parses a profile on-demand using LDO.
 * Use this for event handlers and other non-hook contexts.
 * For React components, prefer using useResource and useSubject hooks.
 * 
 * @param webId - The WebID to fetch
 * @param fetchFn - Optional custom fetch function (e.g., authenticated fetch)
 * @returns The parsed LDO profile
 */
export async function fetchProfileOnDemand(
  webId: string,
  fetchFn: typeof fetch = fetch
): Promise<SolidProfile> {
  const response = await fetchFn(webId, {
    method: 'GET',
    headers: {
      'Accept': 'text/turtle, application/turtle, text/n3',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch profile: ${response.status} ${response.statusText}`);
  }

  const content = await response.text();
  const baseUrl = webId.split('#')[0];

  // Parse RDF using LDO
  const ldoDataset = await parseRdf(content, {
    baseIRI: baseUrl,
    format: "Turtle",
  });

  // Get the profile from the dataset
  const profile = ldoDataset.usingType(ProfileShapeType).fromSubject(webId);
  
  return profile;
}

/**
 * Extracts name and email from a parsed LDO profile
 * @param profile - The LDO SolidProfile object
 * @returns Object with name and email (both can be null)
 */
export function extractNameAndEmail(profile: SolidProfile | null | undefined): {
  name: string | null;
  email: string | null;
} {
  if (!profile) {
    return { name: null, email: null };
  }

  // Prefer vcard:fn, then foaf:name
  const name = profile.fn || profile.name || null;

  // Email handling - hasEmail contains URIs (often mailto: URIs)
  let email: string | null = null;
  if (profile.hasEmail) {
    // LdSet is iterable, iterate over it
    for (const emailObj of profile.hasEmail) {
      if (emailObj && emailObj["@id"]) {
        const emailUri = emailObj["@id"];
        // Check if it's a mailto: URI
        if (emailUri.startsWith('mailto:')) {
          email = emailUri.replace('mailto:', '');
        } else {
          // It might be a blank node or nested vcard structure
          // For now, return the URI as-is if not mailto
          email = emailUri;
        }
        break; // Take only the first email
      }
    }
  }

  return { name, email };
}

/**
 * Gets all storage URLs from a profile (combines pim:storage and solid:storage)
 * @param profile - The LDO SolidProfile object
 * @returns Array of storage URLs
 */
export function getStorageUrls(profile: SolidProfile | null | undefined): string[] {
  if (!profile) {
    return [];
  }

  const storageUrls: string[] = [];

  // pim:storage
  if (profile.storage) {
    for (const storage of profile.storage) {
      if (storage && storage["@id"]) {
        storageUrls.push(storage["@id"]);
      }
    }
  }

  // solid:storage (mapped to storage2 in LDO due to name collision)
  if (profile.storage2) {
    for (const storage of profile.storage2) {
      if (storage && storage["@id"] && !storageUrls.includes(storage["@id"])) {
        storageUrls.push(storage["@id"]);
      }
    }
  }

  return storageUrls;
}

/**
 * Gets all contact WebIDs (foaf:knows) from a profile
 * @param profile - The LDO SolidProfile object
 * @returns Array of WebID URLs
 */
export function getContactWebIds(profile: SolidProfile | null | undefined): string[] {
  if (!profile) {
    return [];
  }

  const contacts: string[] = [];

  if (profile.knows) {
    for (const contact of profile.knows) {
      if (contact && contact["@id"]) {
        contacts.push(contact["@id"]);
      }
    }
  }

  return contacts;
}

/**
 * Gets photo URL from a profile
 * @param profile - The LDO SolidProfile object
 * @param baseUrl - The base URL for resolving relative URLs
 * @returns Photo URL or null
 */
export function getPhotoUrl(profile: SolidProfile | null | undefined, baseUrl: string): string | null {
  if (!profile) {
    return null;
  }

  let photoUrl: string | null = null;

  // Try vcard:hasPhoto first, then foaf:img
  if (profile.hasPhoto && profile.hasPhoto["@id"]) {
    photoUrl = profile.hasPhoto["@id"];
  } else if (profile.img && profile.img["@id"]) {
    photoUrl = profile.img["@id"];
  }

  // Resolve relative URLs
  if (photoUrl && !photoUrl.startsWith('http://') && !photoUrl.startsWith('https://')) {
    try {
      photoUrl = new URL(photoUrl, baseUrl).href;
    } catch (e) {
      // Silent error handling
    }
  }

  return photoUrl;
}

/**
 * Gets website URL from a profile
 * @param profile - The LDO SolidProfile object
 * @returns Website URL or null
 */
export function getWebsiteUrl(profile: SolidProfile | null | undefined): string | null {
  if (!profile) {
    return null;
  }

  // Try vcard:hasURL first, then foaf:homepage
  if (profile.hasURL && profile.hasURL["@id"]) {
    return profile.hasURL["@id"];
  }
  if (profile.homepage && profile.homepage["@id"]) {
    return profile.homepage["@id"];
  }
  return null;
}

/**
 * Gets phone number from a profile
 * @param profile - The LDO SolidProfile object
 * @returns Phone number or null
 */
export function getPhone(profile: SolidProfile | null | undefined): string | null {
  if (!profile) {
    return null;
  }

  if (profile.hasTelephone) {
    for (const phoneObj of profile.hasTelephone) {
      if (phoneObj && phoneObj["@id"]) {
        const phoneUri = phoneObj["@id"];
        return phoneUri.startsWith('tel:') ? phoneUri.replace('tel:', '') : phoneUri;
      }
    }
  }

  return null;
}

/**
 * Gets the display name from a profile with fallback to WebID parsing
 * @param profile - The LDO SolidProfile object
 * @param webId - The WebID to use as fallback for name extraction
 * @returns Display name or null
 */
export function getDisplayName(profile: SolidProfile | null | undefined, webId?: string): string | null {
  const { name } = extractNameAndEmail(profile);
  
  if (name) {
    return name;
  }
  
  // Fallback to WebID parsing
  if (webId) {
    return webId.split("/").pop()?.split("#")[0] || null;
  }
  
  return null;
}
