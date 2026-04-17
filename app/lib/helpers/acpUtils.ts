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
import type { DatasetCore } from "@rdfjs/types"
import { AccessControlResource } from "@/app/lib/class/AccessControlResource"
import { ACP } from "@/app/lib/class/Vocabulary"
import { Matcher } from "@/app/lib/class/Matcher"
import { Policy } from "@/app/lib/class/Policy"
import { AccessControl } from "@/app/lib/class/AccessControl"
import { DataFactory, Parser, Store, Writer } from "n3";

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
 * Returns both the ACR and the dataset for further manipulation
 */
async function fetchAcr(acrUrl: string, fetchFn: typeof fetch): Promise<AcrDataset | null> {
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
    const acrDataset = new AcrDataset(dataset, DataFactory)

    if (acrDataset.acr === undefined) {
      throw new Error // TODO: Handle properly
    }

    // Ensure resource is set
    if (!acrDataset.acr.resource) {
      const resourceUrl = acrUrl.replace(/\.acr$/, "");
      acrDataset.acr.resource = resourceUrl;
    }

    return acrDataset;
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
): Promise<AcrDataset> {
  const { namedNode, blankNode } = DataFactory;
  const ds = new Store

  const acr = new AccessControlResource(namedNode(acrUrl), ds, DataFactory)

  // Add ACR type and resource
  acr.type.add(ACP.AccessControlResource)
  acr.resource = resourceUrl;

  // Create Access Controls for each WebID and access mode
  const accessModes = getAccessModes(accessLevel);

  webIds.forEach((webId) => {
    accessModes.forEach((mode) => {
      // Create blank nodes for nested structure
      const matcher = new Matcher(blankNode(), ds, DataFactory)
      const policy = new Policy(blankNode(), ds, DataFactory)
      const accessControl = new AccessControl(blankNode(), ds, DataFactory)

      // Matcher: type and agent
      matcher.type.add(ACP.Matcher)
      matcher.agent.add(webId)

      // Policy: type, allow, and anyOf (matcher)
      policy.type.add(ACP.Policy)
      policy.allow.add(ACP.mode) // TODO: MODE
      policy.anyOf.add(matcher)

      // AccessControl: type and apply (policy)
      accessControl.type.add(ACP.AccessControl)
      accessControl.apply.add(policy)

      // Link AccessControl to ACR
      acr.accessControl.add(accessControl)
    });
  });

  return new AcrDataset(ds, DataFactory)
}

function write(ds: DatasetCore): Promise<string> {
  return new Promise((resolve, reject) => {
    const writer = new Writer

    writer.addQuads([...ds])

    writer.end((error, result) => {
      if (error) reject(error);
      else resolve(result);
    });
  })
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
  accessLevel: AccessLevel
): Promise<void> {
  if (acrDataset.acr === undefined) {
    throw new Error // TODO: Handle properly
  }

  const existingAgents = new Set<string>();
  try {
    if (acrDataset.acr.accessControl) {
      for (const accessControl of acrDataset.acr.accessControl) {
        for (const policy of accessControl.apply) {
          for (const matcher of policy.anyOf) {
            for (const agent of matcher.agent) {
              existingAgents.add(agent)
            }
          }
        }
      }
    }
  } catch (error) {
    console.warn("Could not parse existing ACR to extract agents:", error);
  }

  // Filter out WebIDs that already have access
  const newWebIds = webIds.filter(webId => !existingAgents.has(webId));
  if (newWebIds.length === 0) {
    // No new WebIDs to add, return existing Turtle
    return;
  }

  // Build new access controls
  const { namedNode, blankNode } = DataFactory;

  const ds = new Store
  const acr = new AccessControlResource(namedNode(acrUrl), ds, DataFactory)

  // Create new access controls for new WebIDs
  newWebIds.forEach((webId) => {
    const accessModes = getAccessModes(accessLevel);
    accessModes.forEach((mode) => {
      const matcher = new Matcher(blankNode(), ds, DataFactory)
      const policy = new Policy(blankNode(), ds, DataFactory)
      const accessControl = new AccessControl(blankNode(), ds, DataFactory)

      matcher.type.add(ACP.Matcher)
      matcher.agent.add(webId)

      policy.type.add(ACP.Policy)
      policy.allow.add(ACP.mode) // TODO: MODE
      policy.anyOf.add(matcher)

      accessControl.type.add(ACP.AccessControl)
      accessControl.apply.add(policy)

      acr.accessControl.add(accessControl)
    });
  });
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

export interface AccessEntry {
  /** Canonical agent key: WebID URI, or "PUBLIC" / "AUTHENTICATED" for special agent classes */
  agent: string;
  /** Original RDF URI of the agent (before normalization). Same as agent for regular WebIDs. */
  rawAgent: string;
  /** Normalized mode names: "Read", "Write", "Append", "Control" */
  modes: string[];
  /** True if this grants access to everyone (foaf:Agent / acp public matcher) */
  isPublic: boolean;
  /** True if this grants access to any authenticated agent */
  isAuthenticated: boolean;
  /** True if these permissions are inherited from a parent container (not set directly on this resource) */
  inherited: boolean;
}

/** Result of getResourceAccessList */
export interface AccessResult {
  entries: AccessEntry[];
  /** URL of the ACL/ACR document that was resolved (may be from a parent if inherited) */
  sourceUrl?: string;
}

// Well-known URIs for public/authenticated agent classes (WAC + ACP variants)
const PUBLIC_AGENTS = new Set([
  "http://xmlns.com/foaf/0.1/Agent",                       // WAC: foaf:Agent
  "http://www.w3.org/ns/solid/acp#PublicAgent",             // ACP (ESS)
  "http://www.w3.org/ns/solid/acp/acp#PublicAgent",         // ACP alternate namespace
]);
const AUTHENTICATED_AGENTS = new Set([
  "http://www.w3.org/ns/auth/acl#AuthenticatedAgent",       // WAC
  "http://www.w3.org/ns/solid/acp#AuthenticatedAgent",      // ACP (ESS)
  "http://www.w3.org/ns/solid/acp/acp#AuthenticatedAgent",  // ACP alternate namespace
]);

function isPublicAgent(agent: string): boolean {
  return PUBLIC_AGENTS.has(agent);
}

function isAuthenticatedAgent(agent: string): boolean {
  return AUTHENTICATED_AGENTS.has(agent);
}

// WAC predicates
const WAC = {
  Authorization: "http://www.w3.org/ns/auth/acl#Authorization",
  agent: "http://www.w3.org/ns/auth/acl#agent",
  agentClass: "http://www.w3.org/ns/auth/acl#agentClass",
  mode: "http://www.w3.org/ns/auth/acl#mode",
  accessTo: "http://www.w3.org/ns/auth/acl#accessTo",
  default_: "http://www.w3.org/ns/auth/acl#default",
};

/**
 * Normalizes a mode URI to a short human-readable name.
 * Handles both WAC (http://www.w3.org/ns/auth/acl#Read) and ACP URIs.
 */
function normalizeMode(modeUri: string): string {
  const fragment = modeUri.includes("#") ? modeUri.split("#").pop() : modeUri.split("/").pop();
  if (!fragment) return modeUri;

  const lower = fragment.toLowerCase();
  if (lower === "read") return "Read";
  if (lower === "write") return "Write";
  if (lower === "append") return "Append";
  if (lower === "control") return "Control";
  // ACP uses "mode" as a generic predicate value — not a real mode name
  if (lower === "mode") return "Read";
  return fragment;
}

/**
 * Discovers the ACL/ACR URL from Link headers. Returns the URL as-is from the server.
 * Does NOT guess ACP vs WAC from the URL — that is determined from the document content.
 */
function discoverAclUrl(linkHeader: string): string | null {
  const aclMatch = linkHeader.match(/<([^>]+)>;\s*rel=["']acl["']/i);
  return aclMatch ? aclMatch[1] : null;
}

/**
 * Detects whether a parsed RDF dataset contains ACP or WAC triples.
 */
function detectAuthType(dataset: Store): "acp" | "wac" | "unknown" {
  const { namedNode } = DataFactory;

  // Check for ACP: look for acp:AccessControlResource type or acp:accessControl predicate
  const acpTypeQuads = dataset.getQuads(
    null,
    namedNode("http://www.w3.org/1999/02/22-rdf-syntax-ns#type"),
    namedNode(ACP.AccessControlResource),
    null,
  );
  if (acpTypeQuads.length > 0) return "acp";

  const acpControlQuads = dataset.getQuads(null, namedNode(ACP.accessControl), null, null);
  if (acpControlQuads.length > 0) return "acp";

  const acpMemberControlQuads = dataset.getQuads(null, namedNode(ACP.memberAccessControl), null, null);
  if (acpMemberControlQuads.length > 0) return "acp";

  // Check for WAC: look for acl:Authorization type
  const wacTypeQuads = dataset.getQuads(
    null,
    namedNode("http://www.w3.org/1999/02/22-rdf-syntax-ns#type"),
    namedNode(WAC.Authorization),
    null,
  );
  if (wacTypeQuads.length > 0) return "wac";

  return "unknown";
}

/**
 * Computes the parent container URL.
 * "http://ex.com/pod/folder/file.txt" → "http://ex.com/pod/folder/"
 * "http://ex.com/pod/folder/" → "http://ex.com/pod/"
 */
function getParentContainerUrl(url: string): string | null {
  try {
    const u = new URL(url);
    // Remove trailing slash for containers so we can go up
    let path = u.pathname;
    if (path.endsWith("/") && path.length > 1) {
      path = path.slice(0, -1);
    }
    const lastSlash = path.lastIndexOf("/");
    if (lastSlash <= 0) return null; // Already at root
    u.pathname = path.slice(0, lastSlash + 1);
    return u.toString();
  } catch {
    return null;
  }
}

/**
 * Collects agents from a set of WAC Authorization quads.
 * scope: "accessTo" = direct rules for the resource, "default" = inherited rules for children.
 */
function collectWacAgents(
  dataset: Store,
  scope: "accessTo" | "default",
  targetResourceUrl: string,
  inherited: boolean,
): AccessEntry[] {
  const { namedNode } = DataFactory;
  const scopePredicate = scope === "accessTo" ? WAC.accessTo : WAC.default_;

  // Find all Authorization subjects
  const authSubjects = dataset.getSubjects(
    namedNode("http://www.w3.org/1999/02/22-rdf-syntax-ns#type"),
    namedNode(WAC.Authorization),
    null
  );

  const agentMap = new Map<string, { rawAgent: string; modes: Set<string>; isPublic: boolean; isAuthenticated: boolean }>();

  for (const authSubject of authSubjects) {
    // Check if this authorization applies to our scope
    const scopeObjects = dataset.getObjects(authSubject, namedNode(scopePredicate), null);
    const applies = scopeObjects.some(o => {
      if (scope === "accessTo") {
        return o.value === targetResourceUrl;
      }
      return true;
    });
    if (scopeObjects.length > 0 && !applies) continue;
    if (scopeObjects.length === 0) continue;

    const modeQuads = dataset.getObjects(authSubject, namedNode(WAC.mode), null);
    const modes = modeQuads.map(m => normalizeMode(m.value));

    // Direct agents
    const agentQuads = dataset.getObjects(authSubject, namedNode(WAC.agent), null);
    for (const agent of agentQuads) {
      const key = agent.value;
      if (!agentMap.has(key)) {
        agentMap.set(key, { rawAgent: key, modes: new Set(), isPublic: false, isAuthenticated: false });
      }
      for (const mode of modes) agentMap.get(key)!.modes.add(mode);
    }

    // Agent classes
    const classQuads = dataset.getObjects(authSubject, namedNode(WAC.agentClass), null);
    for (const cls of classQuads) {
      if (isPublicAgent(cls.value)) {
        if (!agentMap.has("PUBLIC")) {
          agentMap.set("PUBLIC", { rawAgent: cls.value, modes: new Set(), isPublic: true, isAuthenticated: false });
        }
        for (const mode of modes) agentMap.get("PUBLIC")!.modes.add(mode);
      } else if (isAuthenticatedAgent(cls.value)) {
        if (!agentMap.has("AUTHENTICATED")) {
          agentMap.set("AUTHENTICATED", { rawAgent: cls.value, modes: new Set(), isPublic: false, isAuthenticated: true });
        }
        for (const mode of modes) agentMap.get("AUTHENTICATED")!.modes.add(mode);
      }
    }
  }

  return [...agentMap.entries()].map(([agent, data]) => ({
    agent,
    rawAgent: data.rawAgent,
    modes: [...data.modes],
    isPublic: data.isPublic,
    isAuthenticated: data.isAuthenticated,
    inherited,
  }));
}

/**
 * Fetches the access list for a resource, supporting both ACP and WAC.
 *
 * WAC inheritance: if the resource has no own .acl, walks up parent containers
 * to find the nearest .acl with acl:default rules. Results are flagged inherited=true.
 *
 * ACP: fetches the ACR directly. If empty, walks up to find inherited policies.
 */
export async function getResourceAccessList(resourceUrl: string): Promise<AccessResult | null> {
  try {
    const { session, fetch: fetchFn } = getAuthenticatedSession();
    const result = await resolveAccessList(resourceUrl, fetchFn, false);
    if (!result) return null;

    // Filter out the current user's own WebID — it's standard for ACLs to include
    // the owner with full access, but this is noise in the UI.
    const currentWebId = session.info.webId;
    if (currentWebId) {
      result.entries = result.entries.filter(e => e.agent !== currentWebId);
    }

    return result;
  } catch (error) {
    console.error("Failed to get resource access list:", error);
    return null;
  }
}

/**
 * Core recursive resolver. Tries to fetch the ACL/ACR for resourceUrl;
 * if it doesn't exist (404), walks up parent containers.
 *
 * Detection of ACP vs WAC is done by inspecting the fetched document's RDF content,
 * NOT from the URL (ESS serves ACP content at .acl URLs).
 */
async function resolveAccessList(
  resourceUrl: string,
  fetchFn: typeof fetch,
  isInheriting: boolean,
  depth: number = 0,
): Promise<AccessResult | null> {
  if (depth > 10) return { entries: [] }; // Safety limit

  // HEAD the resource to discover ACL URL
  const headResponse = await fetchFn(resourceUrl, {
    method: "HEAD",
    headers: { Accept: "*/*" },
  });

  const linkHeader = headResponse.headers.get("Link") || "";
  const aclUrl = discoverAclUrl(linkHeader);
  if (!aclUrl) {
    return walkUpForInherited(resourceUrl, fetchFn, depth);
  }

  // Fetch the ACL/ACR document
  const response = await fetchFn(aclUrl, {
    method: "GET",
    headers: { Accept: "text/turtle" },
  });

  if (!response.ok) {
    // 404: no ACL/ACR exists, walk up for inherited.
    // 403/other: user may not have permission to read the ACL — treat as unavailable.
    if (response.status === 404 || response.status === 403) {
      return walkUpForInherited(resourceUrl, fetchFn, depth);
    }
    // For other unexpected errors, log and return null rather than crashing the UI.
    console.warn(`Could not fetch ACL/ACR (${response.status} ${response.statusText}) for ${aclUrl}`);
    return null;
  }

  const turtle = await response.text();
  const dataset = new Store();
  dataset.addQuads(new Parser({ baseIRI: aclUrl }).parse(turtle));

  // Detect ACP vs WAC from the document content
  const authType = detectAuthType(dataset);

  if (authType === "acp") {
    // ACP: parse accessControl + memberAccessControl
    const result = parseAcpFromDataset(dataset, aclUrl, isInheriting);
    if (result.entries.length > 0) {
      return result;
    }
    // Empty ACP ACR — walk up for inherited
    return walkUpForInherited(resourceUrl, fetchFn, depth);
  }

  if (authType === "wac") {
    // WAC: check for direct (accessTo) or default rules
    if (!isInheriting) {
      const directEntries = collectWacAgents(dataset, "accessTo", resourceUrl, false);
      if (directEntries.length > 0) {
        return { entries: directEntries, sourceUrl: aclUrl };
      }
      // No direct rules — walk up to find inherited
      return walkUpForInherited(resourceUrl, fetchFn, depth);
    } else {
      // Looking for acl:default rules (inherited from parent)
      const defaultEntries = collectWacAgents(dataset, "default", resourceUrl, true);
      if (defaultEntries.length > 0) {
        return { entries: defaultEntries, sourceUrl: aclUrl };
      }
      // Fallback: check accessTo on the container itself
      const directOnContainer = collectWacAgents(dataset, "accessTo", resourceUrl, true);
      if (directOnContainer.length > 0) {
        return { entries: directOnContainer, sourceUrl: aclUrl };
      }
      return walkUpForInherited(resourceUrl, fetchFn, depth);
    }
  }

  // Unknown auth type — document was fetched but contained neither ACP nor WAC triples
  // This can happen with empty ACR documents on some servers
  return walkUpForInherited(resourceUrl, fetchFn, depth);
}

/**
 * Parses ACP entries from a dataset. Reads both acp:accessControl (direct)
 * and acp:memberAccessControl (inherited by container members, used by ESS).
 */
function parseAcpFromDataset(dataset: Store, acrUrl: string, inherited: boolean): AccessResult {
  const { namedNode } = DataFactory;

  // Collect AccessControl nodes from both predicates
  const directControlQuads = dataset.getQuads(null, namedNode(ACP.accessControl), null, null);
  const memberControlQuads = dataset.getQuads(null, namedNode(ACP.memberAccessControl), null, null);

  type RawEntry = { agent: string; modes: string[]; inherited: boolean };
  const rawEntries: RawEntry[] = [];

  const extractFromControls = (controlQuads: ReturnType<Store["getQuads"]>, isInherited: boolean) => {
    for (const cq of controlQuads) {
      const controlNode = cq.object;

      // Get policies via acp:apply
      const policyQuads = dataset.getQuads(controlNode, namedNode(ACP.apply), null, null);
      for (const pq of policyQuads) {
        const policyNode = pq.object;

        // Get allowed modes from the policy
        const allowQuads = dataset.getQuads(policyNode, namedNode(ACP.allow), null, null);
        const modes = allowQuads.map(aq => normalizeMode(aq.object.value));

        // Get matchers via acp:anyOf
        const matcherQuads = dataset.getQuads(policyNode, namedNode(ACP.anyOf), null, null);
        for (const mq of matcherQuads) {
          const matcherNode = mq.object;

          // Get agents from matcher
          const agentQuads = dataset.getQuads(matcherNode, namedNode(ACP.agent), null, null);
          for (const aq of agentQuads) {
            rawEntries.push({ agent: aq.object.value, modes, inherited: isInherited });
          }
        }

        // Some ACP implementations put acp:agent directly on the policy (without matchers)
        const directAgentQuads = dataset.getQuads(policyNode, namedNode(ACP.agent), null, null);
        for (const aq of directAgentQuads) {
          rawEntries.push({ agent: aq.object.value, modes, inherited: isInherited });
        }
      }
    }
  };

  extractFromControls(directControlQuads, inherited);
  extractFromControls(memberControlQuads, true); // memberAccessControl is always inherited

  // Group by agent URI
  const grouped = new Map<string, { rawAgent: string; modes: Set<string>; inherited: boolean }>();
  for (const entry of rawEntries) {
    if (!grouped.has(entry.agent)) {
      grouped.set(entry.agent, { rawAgent: entry.agent, modes: new Set(), inherited: entry.inherited });
    }
    const group = grouped.get(entry.agent)!;
    for (const mode of entry.modes) {
      group.modes.add(mode);
    }
    if (!entry.inherited) {
      group.inherited = false;
    }
  }

  const entries: AccessEntry[] = [...grouped.entries()].map(([, data]) => {
    const pub = isPublicAgent(data.rawAgent);
    const auth = isAuthenticatedAgent(data.rawAgent);
    return {
      agent: pub ? "PUBLIC" : auth ? "AUTHENTICATED" : data.rawAgent,
      rawAgent: data.rawAgent,
      modes: [...data.modes],
      isPublic: pub,
      isAuthenticated: auth,
      inherited: data.inherited,
    };
  });

  return { entries, sourceUrl: acrUrl };
}

async function walkUpForInherited(
  resourceUrl: string,
  fetchFn: typeof fetch,
  depth: number,
): Promise<AccessResult | null> {
  const parentUrl = getParentContainerUrl(resourceUrl);
  if (!parentUrl) {
    return { entries: [] };
  }
  return resolveAccessList(parentUrl, fetchFn, true, depth + 1);
}

/**
 * Removes access for a specific WebID from a resource's ACR
 * This removes all access controls that grant access to the specified WebID
 */
export async function removeAccessFromResource(
  resourceUrl: string,
  webIdToRemove: string
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

  const acr = new AccessControlResource(DataFactory.namedNode(acrUrl), dataset, DataFactory);

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
