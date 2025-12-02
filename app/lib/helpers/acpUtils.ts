/**
 * ACP Utils
 * 
 * This file contains the utility functions for ACP operations.
 * It creates, updates, and reads Access Control Resources (ACRs) that define who can access resources.
 * The file uses a hybrid approach:
 * LDO (Linked Data Objects): for reading/parsing existing ACRs
 * N3.js: for creating/updating ACRs (because LDO doesn't initialize properties for new subjects)
 */

import { parseRdf, toTurtle, LdoDataset } from "@ldo/ldo";
import { getAuthenticatedSession } from "./sessionUtils";
import {
  AccessControlResource,
} from "../../../src/ldo/Model.typings";
import {
  AccessControlResourceShapeType,
} from "../../../src/ldo/Model.shapeTypes";
import { DataFactory, Writer, Store } from "n3";

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
 * Creates a new ACR with the given policies using N3.js
 * Returns the Turtle serialization ready to be PUT to the server
 * 
 * NOTE: N3.js is used for creation/updates because LDO doesn't initialize
 * properties that don't exist in RDF. LDO is only used for reading existing ACRs.
 */
async function createAcr(
  resourceUrl: string,
  acrUrl: string,
  webIds: string[],
  accessLevel: AccessLevel
): Promise<string> {
  const { namedNode, blankNode, quad } = DataFactory;
  const quads: any[] = [];
  
  const acrSubject = namedNode(acrUrl);
  const acp = "http://www.w3.org/ns/solid/acp#";
  const rdf = "http://www.w3.org/1999/02/22-rdf-syntax-ns#";
  
  // Add ACR type and resource
  quads.push(quad(acrSubject, namedNode(`${rdf}type`), namedNode(`${acp}AccessControlResource`)));
  quads.push(quad(acrSubject, namedNode(`${acp}resource`), namedNode(resourceUrl)));
  
  // Create Access Controls for each WebID and access mode
  const accessModes = getAccessModes(accessLevel);
  let controlIndex = 0;
  
  webIds.forEach((webId) => {
    accessModes.forEach((mode) => {
      // Create blank nodes for nested structure
      const matcherNode = blankNode(`matcher_${controlIndex}`);
      const policyNode = blankNode(`policy_${controlIndex}`);
      const accessControlNode = blankNode(`accessControl_${controlIndex}`);
      
      // Matcher: type and agent
      quads.push(quad(matcherNode, namedNode(`${rdf}type`), namedNode(`${acp}Matcher`)));
      quads.push(quad(matcherNode, namedNode(`${acp}agent`), namedNode(webId)));
      
      // Policy: type, allow, and anyOf (matcher)
      quads.push(quad(policyNode, namedNode(`${rdf}type`), namedNode(`${acp}Policy`)));
      quads.push(quad(policyNode, namedNode(`${acp}allow`), namedNode(`${acp}${mode}`)));
      quads.push(quad(policyNode, namedNode(`${acp}anyOf`), matcherNode));
      
      // AccessControl: type and apply (policy)
      quads.push(quad(accessControlNode, namedNode(`${rdf}type`), namedNode(`${acp}AccessControl`)));
      quads.push(quad(accessControlNode, namedNode(`${acp}apply`), policyNode));
      
      // Link AccessControl to ACR
      quads.push(quad(acrSubject, namedNode(`${acp}accessControl`), accessControlNode));
      
      controlIndex++;
    });
  });
  
  // Convert quads to Turtle using N3 Writer
  return new Promise<string>((resolve, reject) => {
    const writer = new Writer({ prefixes: { acp, rdf } });
    quads.forEach(q => writer.addQuad(q));
    writer.end((error, result) => {
      if (error) reject(error);
      else resolve(result);
    });
  });
}

/**
 * Updates an existing ACR by adding new policies for the given WebIDs
 * Uses N3.js to build new access controls, then merges with existing ACR Turtle
 * Returns the combined Turtle serialization
 * 
 * NOTE: LDO is used only to read the existing ACR and extract existing agents.
 * All updates are done with N3.js.
 */
async function updateAcr(
  existingTurtle: string,
  acrUrl: string,
  webIds: string[],
  accessLevel: AccessLevel
): Promise<string> {
  // Use LDO to parse existing ACR and extract existing agents (LDO works for reading)
  const existingAgents = new Set<string>();
  try {
    const ldoDataset = await parseRdf(existingTurtle, {
      baseIRI: acrUrl,
      format: "Turtle",
    });
    const acr = ldoDataset
      .usingType(AccessControlResourceShapeType)
      .fromSubject(acrUrl);
    
    if (acr.accessControl) {
      acr.accessControl.forEach((accessControl) => {
        if (accessControl.apply?.anyOf?.agent?.["@id"]) {
          existingAgents.add(accessControl.apply.anyOf.agent["@id"]);
        }
      });
    }
  } catch (error) {
    console.warn("Could not parse existing ACR to extract agents:", error);
  }
  
  // Filter out WebIDs that already have access
  const newWebIds = webIds.filter(webId => !existingAgents.has(webId));
  if (newWebIds.length === 0) {
    // No new WebIDs to add, return existing Turtle
    return existingTurtle;
  }
  
  // Build new access controls using N3.js
  const { namedNode, blankNode, quad } = DataFactory;
  const quads: any[] = [];
  
  const acrSubject = namedNode(acrUrl);
  const acp = "http://www.w3.org/ns/solid/acp#";
  const rdf = "http://www.w3.org/1999/02/22-rdf-syntax-ns#";
  
  // Estimate control index from existing agents count
  let controlIndex = existingAgents.size * getAccessModes(accessLevel).length;
  
  // Create new access controls for new WebIDs
  newWebIds.forEach((webId) => {
    const accessModes = getAccessModes(accessLevel);
    accessModes.forEach((mode) => {
      const matcherNode = blankNode(`matcher_${controlIndex}`);
      const policyNode = blankNode(`policy_${controlIndex}`);
      const accessControlNode = blankNode(`accessControl_${controlIndex}`);
      
      quads.push(quad(matcherNode, namedNode(`${rdf}type`), namedNode(`${acp}Matcher`)));
      quads.push(quad(matcherNode, namedNode(`${acp}agent`), namedNode(webId)));
      
      quads.push(quad(policyNode, namedNode(`${rdf}type`), namedNode(`${acp}Policy`)));
      quads.push(quad(policyNode, namedNode(`${acp}allow`), namedNode(`${acp}${mode}`)));
      quads.push(quad(policyNode, namedNode(`${acp}anyOf`), matcherNode));
      
      quads.push(quad(accessControlNode, namedNode(`${rdf}type`), namedNode(`${acp}AccessControl`)));
      quads.push(quad(accessControlNode, namedNode(`${acp}apply`), policyNode));
      
      quads.push(quad(acrSubject, namedNode(`${acp}accessControl`), accessControlNode));
      
      controlIndex++;
    });
  });
  
  // Convert new quads to Turtle
  const newTurtle = await new Promise<string>((resolve, reject) => {
    const writer = new Writer({ prefixes: { acp, rdf } });
    quads.forEach(q => writer.addQuad(q));
    writer.end((error, result) => {
      if (error) reject(error);
      else resolve(result);
    });
  });
  
  // Combine existing and new Turtle
  return existingTurtle + "\n" + newTurtle;
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
    
    // Fetch ACR directly and parse with N3.js since LDO isn't initializing accessControl
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
    
    // Parse with N3.js to extract access controls directly
    const { Parser } = require('n3');
    const parser = new Parser();
    const quads = parser.parse(turtle);
    
    const acp = "http://www.w3.org/ns/solid/acp#";
    const acrSubject = acrUrl;
    const accessMap = new Map<string, Set<string>>();
    
    // Build a map of access controls: accessControl -> policy -> matcher -> agent
    const accessControlToPolicy = new Map<string, string>();
    const policyToMatcher = new Map<string, string>();
    const policyToAllow = new Map<string, string>();
    const matcherToAgent = new Map<string, string>();
    
    quads.forEach((quad: any) => {
      const subject = quad.subject.value;
      const predicate = quad.predicate.value;
      const object = quad.object.value;
      
      // Map accessControl -> policy (via acp:apply)
      if (predicate === `${acp}apply`) {
        accessControlToPolicy.set(subject, object);
      }
      
      // Map policy -> matcher (via acp:anyOf)
      if (predicate === `${acp}anyOf`) {
        policyToMatcher.set(subject, object);
      }
      
      // Map policy -> allow (via acp:allow)
      if (predicate === `${acp}allow`) {
        policyToAllow.set(subject, object);
      }
      
      // Map matcher -> agent (via acp:agent)
      if (predicate === `${acp}agent`) {
        matcherToAgent.set(subject, object);
      }
    });
    
    // Find all access controls linked to the ACR
    quads.forEach((quad: any) => {
      if (quad.subject.value === acrSubject && quad.predicate.value === `${acp}accessControl`) {
        const accessControlNode = quad.object.value;
        const policyNode = accessControlToPolicy.get(accessControlNode);
        
        if (policyNode) {
          const matcherNode = policyToMatcher.get(policyNode);
          const allowValue = policyToAllow.get(policyNode);
          
          if (matcherNode) {
            const agentWebId = matcherToAgent.get(matcherNode);
            
            if (agentWebId && allowValue) {
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
      }
    });

    return Array.from(accessMap.entries()).map(([webId, modes]) => ({
      webId,
      accessModes: Array.from(modes),
    }));
  } catch (error) {
    console.error("Failed to get resource access list:", error);
    return null;
  }
}
