/**
 * ACP Utils
 *
 * This file contains the utility functions for ACP operations.
 * It creates, updates, and reads Access Control Resources (ACRs) that define who can access resources.
 * The file uses a hybrid approach:
 * rdfjs-wrapper (RDF/JS Wrapper): for reading/parsing existing ACRs
 * N3.js: for creating/updating ACRs
 */

import { getAuthenticatedSession } from "./sessionUtils";
import { AcrDataset } from "@/app/lib/class/AcrDataset";
import type { DatasetCore } from "@rdfjs/types";
import { AccessControlResource } from "@/app/lib/class/AccessControlResource";
import { ACP } from "@/app/lib/class/Vocabulary";
import { Matcher } from "@/app/lib/class/Matcher";
import { Policy } from "@/app/lib/class/Policy";
import { AccessControl } from "@/app/lib/class/AccessControl";
import { DataFactory, Parser, Store, Writer } from "n3";
import { getHttpStatus } from "./httpErrorUtils";

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
async function getAcrUrl(
  resourceUrl: string,
  fetchFn: typeof fetch,
): Promise<string> {
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
        if (aclUrl.includes(".acr")) {
          return aclUrl;
        }
        if (aclUrl.includes(".acl")) {
          return aclUrl.replace(".acl", ".acr");
        }
        return aclUrl;
      }
    }
  } catch (error) {
    console.warn(
      "Failed to discover ACR via Link header, using .acr extension:",
      error,
    );
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
  fetchFn: typeof fetch,
): Promise<"acp" | "wac" | "unknown"> {
  try {
    const response = await fetchFn(resourceUrl, {
      method: "HEAD",
      headers: {
        Accept: "*/*",
      },
    });

    const linkHeader = response.headers.get("Link");
    if (linkHeader) {
      if (
        linkHeader.includes("AccessControlResource") ||
        linkHeader.includes(".acr")
      ) {
        return "acp";
      }
      if (linkHeader.includes(".acl") && !linkHeader.includes(".acr")) {
        return "wac";
      }
    }

    try {
      const acrUrl = resourceUrl.endsWith("/")
        ? resourceUrl + ".acr"
        : resourceUrl + ".acr";
      const acrResponse = await fetchFn(acrUrl, { method: "HEAD" });
      if (acrResponse.ok) {
        return "acp";
      }
    } catch {
      // .acr doesn't exist, likely WAC
    }

    return "unknown";
  } catch (error) {
    return "unknown";
  }
}

/**
 * Fetches an existing ACR or returns null if it doesn't exist
 * Returns both the ACR and the dataset for further manipulation
 */
async function fetchAcr(
  acrUrl: string,
  fetchFn: typeof fetch,
): Promise<AcrDataset | null> {
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

    const dataset = new Store();
    dataset.addQuads(new Parser().parse(content));

    // Get typed AccessControlResource from the dataset
    const acrDataset = new AcrDataset(dataset, DataFactory);

    if (acrDataset.acr === undefined) {
      throw new Error(); // TODO: Handle properly
    }

    // Ensure resource is set
    if (!acrDataset.acr.resource) {
      const resourceUrl = acrUrl.replace(/\.acr$/, "");
      acrDataset.acr.resource = resourceUrl;
    }

    return acrDataset;
  } catch (error: unknown) {
    if (getHttpStatus(error) === 404) {
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
  accessLevel: AccessLevel,
): Promise<AcrDataset> {
  const { namedNode, blankNode } = DataFactory;
  const ds = new Store();

  const acr = new AccessControlResource(namedNode(acrUrl), ds, DataFactory);

  // Add ACR type and resource
  acr.type.add(ACP.AccessControlResource);
  acr.resource = resourceUrl;

  // Create Access Controls for each WebID and access mode
  const accessModes = getAccessModes(accessLevel);

  webIds.forEach((webId) => {
    accessModes.forEach((mode) => {
      // Create blank nodes for nested structure
      const matcher = new Matcher(blankNode(), ds, DataFactory);
      const policy = new Policy(blankNode(), ds, DataFactory);
      const accessControl = new AccessControl(blankNode(), ds, DataFactory);

      // Matcher: type and agent
      matcher.type.add(ACP.Matcher);
      matcher.agent.add(webId);

      // Policy: type, allow, and anyOf (matcher)
      policy.type.add(ACP.Policy);
      policy.allow.add(`http://www.w3.org/ns/auth/acl#${mode}`);
      policy.anyOf.add(matcher);

      // AccessControl: type and apply (policy)
      accessControl.type.add(ACP.AccessControl);
      accessControl.apply.add(policy);

      // Link AccessControl to ACR
      acr.accessControl.add(accessControl);
    });
  });

  return new AcrDataset(ds, DataFactory);
}

function write(ds: DatasetCore): Promise<string> {
  return new Promise((resolve, reject) => {
    const writer = new Writer();

    writer.addQuads([...ds]);

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
  acrDataset: AcrDataset,
  acrUrl: string,
  webIds: string[],
  accessLevel: AccessLevel,
): Promise<void> {
  if (acrDataset.acr === undefined) {
    throw new Error(); // TODO: Handle properly
  }

  const existingAgents = new Set<string>();
  try {
    if (acrDataset.acr.accessControl) {
      for (const accessControl of acrDataset.acr.accessControl) {
        for (const policy of accessControl.apply) {
          for (const matcher of policy.anyOf) {
            for (const agent of matcher.agent) {
              existingAgents.add(agent);
            }
          }
        }
      }
    }
  } catch (error) {
    console.warn("Could not parse existing ACR to extract agents:", error);
  }

  // Filter out WebIDs that already have access
  const newWebIds = webIds.filter((webId) => !existingAgents.has(webId));
  if (newWebIds.length === 0) {
    // No new WebIDs to add, return existing Turtle
    return;
  }

  // Build new access controls
  const { namedNode, blankNode } = DataFactory;

  const ds = new Store();
  const acr = new AccessControlResource(namedNode(acrUrl), ds, DataFactory);

  // Create new access controls for new WebIDs
  newWebIds.forEach((webId) => {
    const accessModes = getAccessModes(accessLevel);
    accessModes.forEach((mode) => {
      const matcher = new Matcher(blankNode(), ds, DataFactory);
      const policy = new Policy(blankNode(), ds, DataFactory);
      const accessControl = new AccessControl(blankNode(), ds, DataFactory);

      matcher.type.add(ACP.Matcher);
      matcher.agent.add(webId);

      policy.type.add(ACP.Policy);
      policy.allow.add(`http://www.w3.org/ns/auth/acl#${mode}`);
      policy.anyOf.add(matcher);

      accessControl.type.add(ACP.AccessControl);
      accessControl.apply.add(policy);

      acr.accessControl.add(accessControl);
    });
  });
}

/**
 * Shares a resource with the given WebIDs using ACP
 */
export async function shareResourceWithAcp(
  resourceUrl: string,
  webIds: string[],
  accessLevel: AccessLevel,
): Promise<void> {
  if (webIds.length === 0) {
    return;
  }

  const { fetch } = getAuthenticatedSession();
  const acrUrl = await getAcrUrl(resourceUrl, fetch);

  // Fetch existing ACR or create new one
  let acrDataset = await fetchAcr(acrUrl, fetch);

  if (acrDataset) {
    await updateAcr(acrDataset, acrUrl, webIds, accessLevel);
  } else {
    acrDataset = await createAcr(resourceUrl, acrUrl, webIds, accessLevel);
  }

  // Save ACR
  const response = await fetch(acrUrl, {
    method: "PUT",
    headers: {
      "Content-Type": "text/turtle",
    },
    body: await write(acrDataset),
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

    const canRead =
      headResponse.ok ||
      headResponse.status === 200 ||
      headResponse.status === 304;

    let canWrite = false;
    if (canRead) {
      try {
        const optionsResponse = await fetch(resourceUrl, {
          method: "OPTIONS",
        });

        const allowHeader =
          optionsResponse.headers.get("Allow") ||
          optionsResponse.headers.get("WAC-Allow");
        if (allowHeader) {
          canWrite =
            allowHeader.includes("PUT") ||
            allowHeader.includes("PATCH") ||
            allowHeader.includes("POST");
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
 */
export async function getResourceAccessList(
  resourceUrl: string,
): Promise<Array<{
  webId: string;
  accessModes: string[];
}> | null> {
  try {
    const { fetch } = getAuthenticatedSession();
    const acrUrl = await getAcrUrl(resourceUrl, fetch);

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

    const dataset = new Store();
    dataset.addQuads(new Parser().parse(turtle));

    const acr = new AccessControlResource(
      DataFactory.namedNode(acrUrl),
      dataset,
      DataFactory,
    );

    const rawModesByWebId = [...acr.accessControl].flatMap((ac) =>
      [...ac.apply].flatMap((p) =>
        [...p.anyOf].flatMap((m) =>
          [...m.agent].flatMap((a) => ({
            webId: a,
            accessModes: p.allow,
          })),
        ),
      ),
    );

    const grouped = rawModesByWebId.reduce(groupByWebId, new Map());
    return [...grouped].map(shape);
  } catch (error) {
    console.error("Failed to get resource access list:", error);
    return null;
  }
}

function groupByWebId(
  previous: Map<string, Set<string>>,
  current: { webId: string; accessModes: Set<string> },
) {
  if (!previous.has(current.webId)) {
    previous.set(current.webId, new Set());
  }

  for (const mode of current.accessModes) {
    previous.get(current.webId)!.add(mode);
  }

  return previous;
}

function shape(item: [string, Set<string>]) {
  return {
    webId: item[0],
    accessModes: [...item[1]],
  };
}

/**
 * Removes access for a specific WebID from a resource's ACR
 * This removes all access controls that grant access to the specified WebID
 */
export async function removeAccessFromResource(
  resourceUrl: string,
  webIdToRemove: string,
): Promise<void> {
  const { fetch } = getAuthenticatedSession();
  const acrUrl = await getAcrUrl(resourceUrl, fetch);

  // Fetch the existing ACR
  const response = await fetch(acrUrl, {
    method: "GET",
    headers: {
      Accept: "text/turtle",
    },
  });

  if (!response.ok) {
    if (response.status === 404) {
      // No ACR exists, nothing to remove
      return;
    }
    throw new Error(`Failed to fetch ACR: ${response.statusText}`);
  }

  const turtle = await response.text();
  const dataset = new Store();
  dataset.addQuads(new Parser().parse(turtle));

  const acr = new AccessControlResource(
    DataFactory.namedNode(acrUrl),
    dataset,
    DataFactory,
  );

  // Remove the WebID from all matchers that contain it
  for (const accessControl of acr.accessControl) {
    for (const policy of accessControl.apply) {
      for (const matcher of policy.anyOf) {
        matcher.agent.delete(webIdToRemove);
      }
    }
  }

  // Save the updated ACR
  const updatedTurtle = await write(dataset);

  const saveResponse = await fetch(acrUrl, {
    method: "PUT",
    headers: {
      "Content-Type": "text/turtle",
    },
    body: updatedTurtle,
  });

  if (!saveResponse.ok) {
    throw new Error(`Failed to save ACR: ${saveResponse.statusText}`);
  }
}
