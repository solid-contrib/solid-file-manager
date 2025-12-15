/**
 * ACP Utils
 * 
 * This file contains the utility functions for ACP operations.
 * It creates, updates, and reads Access Control Resources (ACRs) that define who can access resources.
 * Uses LDO (Linked Data Objects) for both reading and writing ACRs.
 */

import { parseRdf, toTurtle, LdoDataset, createLdoDataset } from "@ldo/ldo";
import { getAuthenticatedSession } from "./sessionUtils";
import {
  AccessControlResource,
  AccessControl,
  Policy,
  Matcher,
} from "../../../src/ldo/Model.typings";
import {
  AccessControlResourceShapeType,
  AccessControlShapeType,
  PolicyShapeType,
  MatcherShapeType,
} from "../../../src/ldo/Model.shapeTypes";

const ACP = {
  Read: "http://www.w3.org/ns/solid/acp#Read",
  Write: "http://www.w3.org/ns/solid/acp#Write",
} as const;

export type AccessLevel = "Editor" | "Viewer";

/**
 * Maps access level to ACP access modes
 * 
 * Note: According to PolicyShape, acp:allow is [1..1] (exactly one).
 * So for Editor (Read+Write), we need separate policies - one for Read, one for Write.
 * Each AccessControl can only have one Policy, so I created multiple AccessControls.
 */
function getAccessModes(accessLevel: AccessLevel): ("Read" | "Write")[] {
  if (accessLevel === "Editor") {
    return ["Read", "Write"];
  }
  return ["Read"];
}

/**
 * Gets the ACR URL for a resource
 */
async function getAcrUrl(resourceUrl: string, fetchFn: typeof fetch): Promise<string> {
  try {
    const response = await fetchFn(resourceUrl, {
      method: "HEAD",
      headers: {
        Accept: "*/*",
      },
    });

    const linkHeader = response.headers.get("Link");
    if (linkHeader) {
        // If found, converts .acl to .acr if needed, or uses the provided .acr URL if already present
      const aclMatch = linkHeader.match(/<([^>]+)>;\s*rel=["']acl["']/i);
      if (aclMatch && aclMatch[1]) {
        const aclUrl = aclMatch[1];
        if (aclUrl.includes('.acr')) {
          return aclUrl;
        }
        if (aclUrl.includes('.acl')) {
          return aclUrl.replace('.acl', '.acr');
        }
        return aclUrl;
      }
    }
  } catch (error) {
    console.warn("Failed to discover ACR via Link header, using .acr extension:", error);
  }

  if (resourceUrl.endsWith("/")) {
    return resourceUrl + ".acr";
  }
  return resourceUrl + ".acr";
}

/**
 * Detects if the server supports ACP or only WAC
 */
export async function detectServerAuthMethod(
  resourceUrl: string,
  fetchFn: typeof fetch
): Promise<'acp' | 'wac' | 'unknown'> {
  try {
    const response = await fetchFn(resourceUrl, {
      method: "HEAD",
      headers: {
        Accept: "*/*",
      },
    });

    const linkHeader = response.headers.get("Link");
    if (linkHeader) {
      if (linkHeader.includes('AccessControlResource') || linkHeader.includes('.acr')) {
        return 'acp';
      }
      if (linkHeader.includes('.acl') && !linkHeader.includes('.acr')) {
        return 'wac';
      }
    }

    try {
      const acrUrl = resourceUrl.endsWith("/") ? resourceUrl + ".acr" : resourceUrl + ".acr";
      const acrResponse = await fetchFn(acrUrl, { method: "HEAD" });
      if (acrResponse.ok) {
        return 'acp';
      }
    } catch {
      // .acr doesn't exist, likely WAC
    }

    return 'unknown';
  } catch (error) {
    return 'unknown';
  }
}

/**
 * Fetches an existing ACR or returns null if it doesn't exist
 * Uses LDO to parse and return typed AccessControlResource- Works for reading existing RDF, but initialization can be unreliable.
 * Returns both the ACR and the dataset for further manipulation
 */
async function fetchAcr(
  acrUrl: string,
  fetchFn: typeof fetch
): Promise<{ acr: AccessControlResource; dataset: LdoDataset } | null> {
  try {
    const getResponse = await fetchFn(acrUrl, {
      method: "GET",
      headers: {
        Accept: "text/turtle",
      },
    });

    if (!getResponse.ok) {
      if (getResponse.status === 404) {
        // ACR doesn't exist yet - this is normal, not an error
        // Return null silently - the browser may log the 404, but that's expected
        return null;
      }
      throw new Error(`Failed to fetch ACR: ${getResponse.statusText}`);
    }

    const content = await getResponse.text();
    
    // Parse RDF using LDO
    const ldoDataset = await parseRdf(content, {
      baseIRI: acrUrl,
      format: "Turtle",
    });

    // Get typed AccessControlResource from the dataset
    const acr = ldoDataset
      .usingType(AccessControlResourceShapeType)
      .fromSubject(acrUrl);

    // Ensure resource is set
    if (!acr.resource) {
      const resourceUrl = acrUrl.replace(/\.acr$/, "");
      acr.resource = { "@id": resourceUrl };
    }

    // Ensure the ACR has the rdf:type property initialized otherwise LDO won't initialize the type LdSet
    if (!acr.type) {
      // Ensure the subject exists by setting resource first
      if (!acr.resource) {
        // Try to extract resource URL from acrUrl (remove .acr extension)
        const resourceUrl = acrUrl.replace(/\.acr$/, "");
        acr.resource = { "@id": resourceUrl };
      }
      
      // Get a fresh reference - this should initialize all properties
      const freshAcr = ldoDataset
        .usingType(AccessControlResourceShapeType)
        .fromSubject(acrUrl);
      
      // Ensure resource is set on fresh reference
      if (!freshAcr.resource && acr.resource) {
        freshAcr.resource = acr.resource;
      }
      
      if (!freshAcr.type) {
        // The subject exists but type is still undefined
        // This means LDO isn't initializing it from the shape
        // So this will be handled in updateAcr by ensuring type is set there
        return { acr: freshAcr, dataset: ldoDataset };
      } else {
        return { acr: freshAcr, dataset: ldoDataset };
      }
    }

    return { acr, dataset: ldoDataset };
  } catch (error) {
    if ((error as any)?.status === 404 || (error as any)?.response?.status === 404) {
      return null;
    }
    throw error;
  }
}

/**
 * Creates a new ACR with the given policies using LDO
 * Returns the Turtle serialization ready to be PUT to the server
 */
async function createAcr(
  resourceUrl: string,
  acrUrl: string,
  webIds: string[],
  accessLevel: AccessLevel
): Promise<string> {
  const ACP_NS = "http://www.w3.org/ns/solid/acp#";
  
  // Create a new LDO dataset
  const ldoDataset = createLdoDataset();
  
  // Create the ACR subject
  const acr = ldoDataset
    .usingType(AccessControlResourceShapeType)
    .fromSubject(acrUrl);
  
  // Set ACR type and resource
  acr.type.add({ "@id": `${ACP_NS}AccessControlResource` });
  acr.resource = { "@id": resourceUrl };
  
  // Create Access Controls for each WebID and access mode
  const accessModes = getAccessModes(accessLevel);
  let controlIndex = 0;
  
  webIds.forEach((webId) => {
    accessModes.forEach((mode) => {
      // Create Matcher with blank node
      const matcherId = `_:matcher_${controlIndex}`;
      const matcher = ldoDataset
        .usingType(MatcherShapeType)
        .fromSubject(matcherId);
      matcher.type.add({ "@id": `${ACP_NS}Matcher` });
      matcher.agent = { "@id": webId };
      
      // Create Policy with blank node
      const policyId = `_:policy_${controlIndex}`;
      const policy = ldoDataset
        .usingType(PolicyShapeType)
        .fromSubject(policyId);
      policy.type.add({ "@id": `${ACP_NS}Policy` });
      policy.allow = { "@id": `${ACP_NS}${mode}` };
      policy.anyOf = matcher;
      
      // Create AccessControl with blank node
      const accessControlId = `_:accessControl_${controlIndex}`;
      const accessControl = ldoDataset
        .usingType(AccessControlShapeType)
        .fromSubject(accessControlId);
      accessControl.type.add({ "@id": `${ACP_NS}AccessControl` });
      accessControl.apply = policy;
      
      // Link AccessControl to ACR
      acr.accessControl.add(accessControl);
      
      controlIndex++;
    });
  });
  
  // Serialize to Turtle
  return toTurtle(acr);
}

/**
 * Updates an existing ACR by adding new policies for the given WebIDs
 * Uses LDO to parse existing ACR, add new access controls, and serialize
 * Returns the combined Turtle serialization
 */
async function updateAcr(
  existingTurtle: string,
  acrUrl: string,
  webIds: string[],
  accessLevel: AccessLevel
): Promise<string> {
  const ACP_NS = "http://www.w3.org/ns/solid/acp#";
  
  // Parse existing ACR with LDO
  const ldoDataset = await parseRdf(existingTurtle, {
    baseIRI: acrUrl,
    format: "Turtle",
  });
  
  const acr = ldoDataset
    .usingType(AccessControlResourceShapeType)
    .fromSubject(acrUrl);
  
  // Extract existing agents to avoid duplicates
  const existingAgents = new Set<string>();
  if (acr.accessControl) {
    for (const accessControl of acr.accessControl) {
      if (accessControl.apply?.anyOf?.agent?.["@id"]) {
        existingAgents.add(accessControl.apply.anyOf.agent["@id"]);
      }
    }
  }
  
  // Filter out WebIDs that already have access
  const newWebIds = webIds.filter(webId => !existingAgents.has(webId));
  if (newWebIds.length === 0) {
    // No new WebIDs to add, return existing Turtle
    return existingTurtle;
  }
  
  // Estimate control index from existing agents count
  let controlIndex = existingAgents.size * getAccessModes(accessLevel).length;
  
  // Create new access controls for new WebIDs
  newWebIds.forEach((webId) => {
    const accessModes = getAccessModes(accessLevel);
    accessModes.forEach((mode) => {
      // Create Matcher with blank node
      const matcherId = `_:matcher_${controlIndex}`;
      const matcher = ldoDataset
        .usingType(MatcherShapeType)
        .fromSubject(matcherId);
      matcher.type.add({ "@id": `${ACP_NS}Matcher` });
      matcher.agent = { "@id": webId };
      
      // Create Policy with blank node
      const policyId = `_:policy_${controlIndex}`;
      const policy = ldoDataset
        .usingType(PolicyShapeType)
        .fromSubject(policyId);
      policy.type.add({ "@id": `${ACP_NS}Policy` });
      policy.allow = { "@id": `${ACP_NS}${mode}` };
      policy.anyOf = matcher;
      
      // Create AccessControl with blank node
      const accessControlId = `_:accessControl_${controlIndex}`;
      const accessControl = ldoDataset
        .usingType(AccessControlShapeType)
        .fromSubject(accessControlId);
      accessControl.type.add({ "@id": `${ACP_NS}AccessControl` });
      accessControl.apply = policy;
      
      // Link AccessControl to ACR
      acr.accessControl.add(accessControl);
      
      controlIndex++;
    });
  });
  
  // Serialize to Turtle
  return toTurtle(acr);
}

/**
 * Shares a resource with the given WebIDs using ACP
 */
export async function shareResourceWithAcp(
  resourceUrl: string,
  webIds: string[],
  accessLevel: AccessLevel
): Promise<void> {
  if (webIds.length === 0) {
    return;
  }

  const { fetch } = getAuthenticatedSession();
  const acrUrl = await getAcrUrl(resourceUrl, fetch);
  
  // Fetch existing ACR or create new one
  const fetched = await fetchAcr(acrUrl, fetch);
  let turtle: string;
  
  if (fetched) {
    // Use LDO to serialize existing ACR to Turtle (LDO works for reading/serializing)
    const existingTurtle = await toTurtle(fetched.acr);
    
    // Use N3.js to add new access controls
    turtle = await updateAcr(existingTurtle, acrUrl, webIds, accessLevel);
  } else {
    // Create new ACR using N3.js
    turtle = await createAcr(resourceUrl, acrUrl, webIds, accessLevel);
  }

  // Save ACR
  const response = await fetch(acrUrl, {
    method: "PUT",
    headers: {
      "Content-Type": "text/turtle",
    },
    body: turtle,
  });

  if (!response.ok) {
    throw new Error(`Failed to save ACR: ${response.statusText}`);
  }
}

/**
 * Verifies that the current user has access to a resource
 */
export async function verifyResourceAccess(resourceUrl: string): Promise<{
  hasAccess: boolean;
  canRead: boolean;
  canWrite: boolean;
  error?: string;
}> {
  try {
    const { fetch } = getAuthenticatedSession();
    
    const headResponse = await fetch(resourceUrl, {
      method: "HEAD",
      headers: {
        Accept: "*/*",
      },
    });

    const canRead = headResponse.ok || headResponse.status === 200 || headResponse.status === 304;

    let canWrite = false;
    if (canRead) {
      try {
        const optionsResponse = await fetch(resourceUrl, {
          method: "OPTIONS",
        });
        
        const allowHeader = optionsResponse.headers.get("Allow") || optionsResponse.headers.get("WAC-Allow");
        if (allowHeader) {
          canWrite = allowHeader.includes("PUT") || allowHeader.includes("PATCH") || allowHeader.includes("POST");
        }
      } catch (error) {
        console.warn("Could not check write permissions:", error);
      }
    }

    return {
      hasAccess: canRead,
      canRead,
      canWrite,
    };
  } catch (error) {
    return {
      hasAccess: false,
      canRead: false,
      canWrite: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Fetches the ACR for a resource to see who has access
 * Uses LDO to parse and return typed data
 */
export async function getResourceAccessList(resourceUrl: string): Promise<Array<{
  webId: string;
  accessModes: string[];
}> | null> {
  try {
    const { fetch } = getAuthenticatedSession();
    const acrUrl = await getAcrUrl(resourceUrl, fetch);
    
    // Fetch ACR and parse with LDO
    const response = await fetch(acrUrl, {
      method: "GET",
      headers: {
        Accept: "text/turtle",
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return [];
      }
      throw new Error(`Failed to fetch ACR: ${response.statusText}`);
    }

    const turtle = await response.text();
    
    // Parse with LDO
    const ldoDataset = await parseRdf(turtle, {
      baseIRI: acrUrl,
      format: "Turtle",
    });
    
    const acr = ldoDataset
      .usingType(AccessControlResourceShapeType)
      .fromSubject(acrUrl);
    
    // Build access map from the ACR
    const accessMap = new Map<string, Set<string>>();
    
    if (acr.accessControl) {
      for (const accessControl of acr.accessControl) {
        if (accessControl.apply?.anyOf?.agent?.["@id"] && accessControl.apply?.allow?.["@id"]) {
          const agentWebId = accessControl.apply.anyOf.agent["@id"];
          const allowValue = accessControl.apply.allow["@id"];
          
          // Determine access mode
          let accessMode: string | null = null;
          if (allowValue === ACP.Read || allowValue.endsWith("#Read") || allowValue.endsWith("/Read")) {
            accessMode = ACP.Read;
          } else if (allowValue === ACP.Write || allowValue.endsWith("#Write") || allowValue.endsWith("/Write")) {
            accessMode = ACP.Write;
          }
          
          if (accessMode) {
            if (!accessMap.has(agentWebId)) {
              accessMap.set(agentWebId, new Set());
            }
            accessMap.get(agentWebId)!.add(accessMode);
          }
        }
      }
    }

    return Array.from(accessMap.entries()).map(([webId, modes]) => ({
      webId,
      accessModes: Array.from(modes),
    }));
  } catch (error) {
    console.error("Failed to get resource access list:", error);
    return null;
  }
}
