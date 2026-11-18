/**
 * Sharing on ACP servers (Community Solid Server, ESS): reads and edits a
 * resource's Access Control Resource (ACR).
 *
 * The app only ever edits grants it could have written itself: policies that
 * allow nothing beyond acl:Read, acl:Write and acl:Append and deny nothing.
 * Policies that grant Control (the owner's) or deny access are never touched,
 * and every edit only narrows the access of the agent being changed.
 */

import type { NamedNode, Quad_Object, Quad_Subject, Term } from "@rdfjs/types";
import { DataFactory, Parser, Store, Writer } from "n3";
import { discoverAccessControl, UnsupportedAccessControlError } from "./accessControl";

export type AccessLevel = "Editor" | "Viewer";
export type AccessMode = "Read" | "Write" | "Append" | "Control";

export interface AccessEntry {
  webId: string;
  accessModes: AccessMode[];
  /** False when some of this agent's access isn't the app's to remove (e.g. an owner's Control). */
  canRemove: boolean;
}

const { blankNode, namedNode, quad } = DataFactory;
const ACP = "http://www.w3.org/ns/solid/acp#";
const ACL = "http://www.w3.org/ns/auth/acl#";
const RDF_TYPE = namedNode("http://www.w3.org/1999/02/22-rdf-syntax-ns#type");
const acp = (name: string) => namedNode(ACP + name);
const ACCESS_CONTROL = acp("accessControl");
const MEMBER_ACCESS_CONTROL = acp("memberAccessControl");
const APPLY = acp("apply");
const ALLOW = acp("allow");
const DENY = acp("deny");
const ANY_OF = acp("anyOf");
const AGENT = acp("agent");
const MODES: AccessMode[] = ["Read", "Write", "Append", "Control"];
const SHAREABLE_MODES = new Set([ACL + "Read", ACL + "Write", ACL + "Append"]);

export const LEVEL_MODES: Record<AccessLevel, AccessMode[]> = {
  Viewer: ["Read"],
  Editor: ["Read", "Write"],
};

/** Thrown when an agent's existing access can't be changed without changing its meaning. */
export class UnmanagedAccessError extends Error {
  constructor(readonly webId: string) {
    super(`${webId} already has access here with full control or extra conditions, which this app can't change.`);
    this.name = "UnmanagedAccessError";
  }
}

/** Thrown when asked to change the signed-in user's own access. */
export class OwnAccessError extends Error {
  constructor() {
    super("You can't change your own access here.");
    this.name = "OwnAccessError";
  }
}

/**
 * The resource's ACR, from its Link rel="acl" header. Throws
 * UnsupportedAccessControlError on WAC servers and servers without one.
 */
async function getAcrUrl(resourceUrl: string, fetchFn: typeof fetch): Promise<string> {
  const accessControl = await discoverAccessControl(resourceUrl, fetchFn);
  if (accessControl?.kind !== "acp") throw new UnsupportedAccessControlError(accessControl?.kind ?? "none");
  return accessControl.url;
}

/**
 * PUTs an ACR, failing if someone else changed it since we read it (If-Match),
 * or created one while we were creating ours (If-None-Match). An existing ACR
 * served without an ETag can't be guarded, so it is saved unconditionally:
 * refusing would make sharing impossible on such servers (ESS sends none;
 * Community Solid Server does).
 */
export async function saveAcr(
  acrUrl: string,
  body: string,
  previous: { etag: string | null } | "new",
  fetchFn: typeof fetch,
): Promise<void> {
  const condition: Record<string, string> =
    previous === "new" ? { "If-None-Match": "*" } : previous.etag ? { "If-Match": previous.etag } : {};
  const response = await fetchFn(acrUrl, {
    method: "PUT",
    headers: { "Content-Type": "text/turtle", ...condition },
    body,
  });
  if (response.status === 412) {
    throw new Error("The sharing settings were changed by someone else just now. Please try again.");
  }
  if (!response.ok) {
    throw new Error(`Failed to save ACR: ${response.status} ${response.statusText}`);
  }
}

interface LoadedAcr {
  store: Store;
  /** The ACR node itself (CSS: a fragment such as <#root>; ESS: the document). */
  acr: Quad_Subject;
  etag: string | null;
}

/** GETs and parses an ACR (relative IRIs resolved against it). Null when it doesn't exist yet. */
async function loadAcr(acrUrl: string, resourceUrl: string, fetchFn: typeof fetch): Promise<LoadedAcr | null> {
  const response = await fetchFn(acrUrl, { headers: { Accept: "text/turtle" } });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Couldn't read the sharing settings (${response.status}).`);

  const store = new Store(new Parser({ baseIRI: response.url || acrUrl }).parse(await response.text()));
  return { store, acr: findAcrNode(store, resourceUrl), etag: response.headers.get("ETag") };
}

/**
 * The node describing the resource's access: the one with acp:resource <resource>
 * (Community Solid Server), else the only node typed acp:AccessControlResource
 * (ESS, which omits acp:resource).
 */
function findAcrNode(store: Store, resourceUrl: string): Quad_Subject {
  const forResource = store.getSubjects(acp("resource"), namedNode(resourceUrl), null);
  if (forResource.length === 1) return forResource[0];
  const typed = store.getSubjects(RDF_TYPE, acp("AccessControlResource"), null);
  if (forResource.length === 0 && typed.length === 1) return typed[0];
  throw new Error("Couldn't read the sharing settings for this item.");
}

function newAcr(acrUrl: string, resourceUrl: string): LoadedAcr {
  const store = new Store();
  const acr = namedNode(acrUrl);
  store.addQuads([
    quad(acr, RDF_TYPE, acp("AccessControlResource")),
    quad(acr, acp("resource"), namedNode(resourceUrl)),
  ]);
  return { store, acr, etag: null };
}

/** Access controls that apply to the resource itself, and for a folder also to its contents. */
function attachmentsFor(resourceUrl: string): NamedNode[] {
  return resourceUrl.endsWith("/") ? [ACCESS_CONTROL, MEMBER_ACCESS_CONTROL] : [ACCESS_CONTROL];
}

/** A policy the app may edit: it allows only Read/Write/Append and denies nothing. */
function isShareablePolicy(store: Store, policy: Term): boolean {
  const allowed = store.getObjects(policy, ALLOW, null);
  return (
    allowed.length > 0 &&
    allowed.every((mode) => SHAREABLE_MODES.has(mode.value)) &&
    store.countQuads(policy, DENY, null, null) === 0
  );
}

/** Every policy applied by an access control attached to the ACR through `attachments`. */
function policiesOf(store: Store, acr: Quad_Subject, attachments: NamedNode[]): Term[] {
  const policies = attachments.flatMap((attachment) =>
    store.getObjects(acr, attachment, null).flatMap((control) => store.getObjects(control, APPLY, null)),
  );
  return policies.filter((policy, i) => policies.findIndex((other) => other.equals(policy)) === i);
}

/** Deletes a node's own triples once nothing points at it, then does the same for what it pointed at. */
function dropIfUnused(store: Store, node: Term): void {
  if (node.termType === "Literal" || store.countQuads(null, null, node, null) > 0) return;
  const children = [APPLY, ANY_OF, acp("allOf"), acp("noneOf")].flatMap((p) =>
    store.getObjects(node as Quad_Subject, p, null),
  );
  store.removeQuads(store.getQuads(node as Quad_Subject, null, null, null));
  children.forEach((child) => dropIfUnused(store, child));
}

/**
 * Removes the agent from every shareable policy attached through `attachments`.
 * Only ever narrows access: the agent is taken out of an acp:anyOf matcher that
 * names other agents too (copied first if other policies use it, so they keep
 * it); a matcher naming only this agent is dropped from the policy, and a
 * policy left without anyOf matchers is detached (rather than left matching on
 * its other conditions). Returns whether anything changed.
 */
function removeAgent(store: Store, acr: Quad_Subject, webId: string, attachments: NamedNode[]): boolean {
  const agent = namedNode(webId);
  let changed = false;
  ownControls(store, acr, agent, attachments);
  const managed = attachments.flatMap((attachment) => store.getObjects(acr, attachment, null));
  for (const policy of policiesOf(store, acr, attachments)) {
    if (!isShareablePolicy(store, policy)) continue;
    if (!store.getObjects(policy, ANY_OF, null).some((m) => store.has(quad(m as Quad_Subject, AGENT, agent)))) continue;
    const p = ownCopy(store, policy as Quad_Subject, managed);
    let touched = false;
    for (const matcher of store.getObjects(p, ANY_OF, null)) {
      const m = matcher as Quad_Subject;
      if (!store.has(quad(m, AGENT, agent))) continue;
      touched = true;
      const conditions = store.getQuads(m, null, null, null).filter((q) => !q.predicate.equals(RDF_TYPE));
      const otherAgents = conditions.filter((q) => q.predicate.equals(AGENT) && !q.object.equals(agent));
      if (otherAgents.length > 0) {
        // Still limited to the other agents, so this narrows. A matcher also used elsewhere is copied, not edited.
        if (store.countQuads(null, null, m, null) > 1) {
          const copy = blankNode();
          store.removeQuad(quad(p, ANY_OF, m));
          store.addQuads([
            quad(p, ANY_OF, copy),
            quad(copy, RDF_TYPE, acp("Matcher")),
            ...conditions
              .filter((q) => !(q.predicate.equals(AGENT) && q.object.equals(agent)))
              .map((q) => quad(copy, q.predicate, q.object)),
          ]);
        } else {
          store.removeQuad(quad(m, AGENT, agent));
        }
      } else {
        store.removeQuad(quad(p, ANY_OF, m));
        dropIfUnused(store, m);
      }
    }
    if (!touched) continue;
    changed = true;
    if (store.countQuads(p, ANY_OF, null, null) > 0) continue;
    // Detach the emptied policy from this ACR's controls (the only ones applying it, see ownCopy).
    for (const holder of store.getSubjects(APPLY, p, null)) {
      store.removeQuad(quad(holder, APPLY, p));
      if (store.countQuads(holder, APPLY, null, null) === 0) {
        for (const via of [ACCESS_CONTROL, MEMBER_ACCESS_CONTROL]) store.removeQuad(quad(acr, via, holder as Quad_Object));
        dropIfUnused(store, holder);
      }
    }
    dropIfUnused(store, p);
  }
  return changed;
}

/**
 * Gives this ACR its own copy of every access control that grants `agent`
 * something and is also referenced from elsewhere (another ACR in the same
 * document, say), so that editing it here can't change access there.
 */
function ownControls(store: Store, acr: Quad_Subject, agent: NamedNode, attachments: NamedNode[]): void {
  const namesAgent = (policy: Term) =>
    store.getObjects(policy, ANY_OF, null).some((m) => store.has(quad(m as Quad_Subject, AGENT, agent)));
  const controls = attachments.flatMap((attachment) => store.getObjects(acr, attachment, null));
  for (const control of controls.filter((c, i) => controls.findIndex((o) => o.equals(c)) === i)) {
    if (!store.getObjects(control, APPLY, null).some(namesAgent)) continue;
    const elsewhere = store
      .getQuads(null, null, control, null)
      .some((q) => !(q.subject.equals(acr) && attachments.some((a) => a.equals(q.predicate))));
    if (!elsewhere) continue;
    const copy = blankNode();
    store.addQuads(store.getQuads(control as Quad_Subject, null, null, null).map((q) => quad(copy, q.predicate, q.object)));
    for (const attachment of attachments) {
      if (!store.has(quad(acr, attachment, control as Quad_Object))) continue;
      store.removeQuad(quad(acr, attachment, control as Quad_Object));
      store.addQuad(quad(acr, attachment, copy));
    }
  }
}

/**
 * The policy to edit for this ACR: the policy itself, or, if controls outside
 * `managed` also apply it, a copy that only `managed` controls apply from now
 * on, so editing it can't change anyone's access elsewhere.
 */
function ownCopy(store: Store, policy: Quad_Subject, managed: Term[]): Quad_Subject {
  const holders = store.getSubjects(APPLY, policy, null);
  if (holders.every((holder) => managed.some((m) => m.equals(holder)))) return policy;
  const copy = blankNode();
  store.addQuads(store.getQuads(policy, null, null, null).map((q) => quad(copy, q.predicate, q.object)));
  for (const holder of holders.filter((h) => managed.some((m) => m.equals(h)))) {
    store.removeQuad(quad(holder, APPLY, policy));
    store.addQuad(quad(holder, APPLY, copy));
  }
  return copy;
}

/**
 * Whether the agent has access here that the app can't replace with a plain
 * grant without changing its meaning: through a policy granting Control or
 * denying access, a policy with acp:allOf / acp:noneOf conditions, or a matcher
 * with conditions besides acp:agent (such as acp:client).
 */
function hasUnmanagedGrant(store: Store, acr: Quad_Subject, webId: string, attachments: NamedNode[]): boolean {
  const agent = namedNode(webId);
  return policiesOf(store, acr, attachments).some((policy) => {
    const p = policy as Quad_Subject;
    const matchers = [ANY_OF, acp("allOf"), acp("noneOf")].flatMap((via) =>
      store.getObjects(p, via, null).map((matcher) => ({ via, matcher: matcher as Quad_Subject })),
    );
    const naming = matchers.filter(({ matcher }) => store.has(quad(matcher, AGENT, agent)));
    if (naming.length === 0) return false;
    if (!isShareablePolicy(store, p) || matchers.some(({ via }) => !via.equals(ANY_OF))) return true;
    return naming.some(({ matcher }) =>
      store.getQuads(matcher, null, null, null).some((q) => !q.predicate.equals(RDF_TYPE) && !q.predicate.equals(AGENT)),
    );
  });
}

/** Adds one access control granting the agent `modes`, as named nodes in the ACR document. */
function addGrant(store: Store, acr: Quad_Subject, acrUrl: string, webId: string, modes: AccessMode[], attachments: NamedNode[]) {
  const base = `${acrUrl.split("#")[0]}#share-${crypto.randomUUID()}`;
  const control = namedNode(base);
  const policy = namedNode(`${base}-policy`);
  const matcher = namedNode(`${base}-matcher`);
  store.addQuads([
    quad(control, RDF_TYPE, acp("AccessControl")),
    quad(control, APPLY, policy),
    quad(policy, RDF_TYPE, acp("Policy")),
    ...modes.map((mode) => quad(policy, ALLOW, namedNode(ACL + mode))),
    quad(policy, ANY_OF, matcher),
    quad(matcher, RDF_TYPE, acp("Matcher")),
    quad(matcher, AGENT, namedNode(webId)),
    ...attachments.map((attachment) => quad(acr, attachment, control)),
  ]);
}

function serialise(store: Store): Promise<string> {
  return new Promise((resolve, reject) => {
    const writer = new Writer({ prefixes: { acp: ACP, acl: ACL } });
    writer.addQuads(store.getQuads(null, null, null, null));
    writer.end((error, result) => (error ? reject(error) : resolve(result)));
  });
}

/**
 * Gives each WebID exactly `accessLevel` on the resource (and, for a folder,
 * its contents): their earlier plain grants are replaced, so a viewer can
 * become an editor and back. Refuses to change `ownWebId`'s access, or access
 * the app can't represent (Control, extra conditions).
 */
export async function shareResourceWithAcp(
  resourceUrl: string,
  webIds: string[],
  accessLevel: AccessLevel,
  fetchFn: typeof fetch,
  ownWebId: string | undefined,
): Promise<void> {
  if (webIds.length === 0) return;
  if (ownWebId && webIds.includes(ownWebId)) throw new OwnAccessError();

  const acrUrl = await getAcrUrl(resourceUrl, fetchFn);
  const existing = await loadAcr(acrUrl, resourceUrl, fetchFn);
  const { store, acr } = existing ?? newAcr(acrUrl, resourceUrl);
  const attachments = attachmentsFor(resourceUrl);
  const unmanaged = webIds.find((webId) => hasUnmanagedGrant(store, acr, webId, attachments));
  if (unmanaged) throw new UnmanagedAccessError(unmanaged);

  for (const webId of new Set(webIds)) {
    removeAgent(store, acr, webId, attachments);
    addGrant(store, acr, acrUrl, webId, LEVEL_MODES[accessLevel], attachments);
  }
  await saveAcr(acrUrl, await serialise(store), existing ? { etag: existing.etag } : "new", fetchFn);
}

/**
 * Who has access to the resource through its own ACR, and with which modes.
 * Access inherited from a parent folder, or defined in other documents (as
 * ESS does), isn't listed. Null when the ACR can't be read.
 */
export async function getResourceAccessList(
  resourceUrl: string,
  fetchFn: typeof fetch,
): Promise<AccessEntry[] | null> {
  try {
    const acrUrl = await getAcrUrl(resourceUrl, fetchFn);
    const loaded = await loadAcr(acrUrl, resourceUrl, fetchFn);
    if (!loaded) return [];
    const { store, acr } = loaded;

    const entries = new Map<string, { modes: Set<AccessMode>; canRemove: boolean }>();
    for (const policy of policiesOf(store, acr, [ACCESS_CONTROL])) {
      const modes = store
        .getObjects(policy, ALLOW, null)
        .map((mode) => MODES.find((m) => ACL + m === mode.value))
        .filter((mode): mode is AccessMode => mode !== undefined);
      if (modes.length === 0) continue;
      const shareable = isShareablePolicy(store, policy);
      for (const matcher of store.getObjects(policy, ANY_OF, null)) {
        for (const agent of store.getObjects(matcher, AGENT, null)) {
          const entry = entries.get(agent.value) ?? { modes: new Set<AccessMode>(), canRemove: true };
          modes.forEach((mode) => entry.modes.add(mode));
          entry.canRemove &&= shareable;
          entries.set(agent.value, entry);
        }
      }
    }
    return [...entries].map(([webId, { modes, canRemove }]) => ({
      webId,
      accessModes: MODES.filter((mode) => modes.has(mode)),
      canRemove,
    }));
  } catch (error) {
    console.error("Failed to get resource access list:", error);
    return null;
  }
}

/**
 * Removes the access the app can manage for `webIdToRemove` (on the resource
 * and, for a folder, its contents). Never touches Control or deny policies, and
 * refuses to change `ownWebId`'s access.
 */
export async function removeAccessFromResource(
  resourceUrl: string,
  webIdToRemove: string,
  fetchFn: typeof fetch,
  ownWebId: string | undefined,
): Promise<void> {
  if (ownWebId && webIdToRemove === ownWebId) throw new OwnAccessError();

  const acrUrl = await getAcrUrl(resourceUrl, fetchFn);
  const loaded = await loadAcr(acrUrl, resourceUrl, fetchFn);
  if (!loaded) return;
  const { store, acr, etag } = loaded;

  if (!removeAgent(store, acr, webIdToRemove, attachmentsFor(resourceUrl))) return;
  await saveAcr(acrUrl, await serialise(store), { etag }, fetchFn);
}
