/**
 * Sharing on WAC servers (e.g. solidcommunity.net): reads and edits a
 * resource's .acl document.
 *
 * As with ACP, the app only edits rules it could have written itself: rules
 * granting nothing beyond acl:Read, acl:Write and acl:Append, without
 * acl:origin restrictions. Rules granting Control (the owner's) are never
 * touched, and removing someone only ever narrows access.
 */

import type { NamedNode, Quad, Quad_Subject } from "@rdfjs/types";
import { DataFactory, Parser, Store, Writer } from "n3";
import { linkTargets } from "./accessControl";
import {
  LEVEL_MODES,
  OwnAccessError,
  saveAcr,
  UnmanagedAccessError,
  type AccessEntry,
  type AccessLevel,
  type AccessMode,
} from "./acpUtils";

const { namedNode, quad } = DataFactory;
const ACL = "http://www.w3.org/ns/auth/acl#";
const RDF_TYPE = namedNode("http://www.w3.org/1999/02/22-rdf-syntax-ns#type");
const acl = (name: string) => namedNode(ACL + name);
const ACCESS_TO = acl("accessTo");
const DEFAULT = acl("default");
const MODE = acl("mode");
const ORIGIN = acl("origin");
const AGENT = acl("agent");
/** Who a rule applies to: any one of these matching is enough. */
const WHO = [AGENT, acl("agentClass"), acl("agentGroup")];
const TARGETS = [ACCESS_TO, DEFAULT];
const PIM_STORAGE = "http://www.w3.org/ns/pim/space#Storage";
/** Agent classes covering people the app can't single out. */
const EVERYONE = [namedNode("http://xmlns.com/foaf/0.1/Agent"), acl("AuthenticatedAgent")];
const MODES: AccessMode[] = ["Read", "Write", "Append", "Control"];
const SHAREABLE_MODES = new Set([ACL + "Read", ACL + "Write", ACL + "Append"]);

interface AclDocument {
  url: string;
  store: Store;
  etag: string | null;
}

/**
 * WAC servers keep a resource's .acl beside it, so an .acl advertised on
 * another origin is refused rather than sent the user's credentials.
 */
function assertBeside(aclUrl: string, resourceUrl: string): void {
  if (new URL(aclUrl).origin !== new URL(resourceUrl).origin) {
    throw new Error("This item's sharing settings are on another server, so they weren't opened.");
  }
}

/**
 * GETs and parses an .acl (relative IRIs resolved against it). Null when it
 * doesn't exist. Redirects are refused, so a request can't be steered away
 * from the URL checked by assertBeside.
 */
async function loadAcl(aclUrl: string, fetchFn: typeof fetch): Promise<AclDocument | null> {
  const response = await fetchFn(aclUrl, { headers: { Accept: "text/turtle" }, redirect: "error" });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Couldn't read the sharing settings (${response.status}).`);
  const store = new Store(new Parser({ baseIRI: aclUrl }).parse(await response.text()));
  return { url: aclUrl, store, etag: response.headers.get("ETag") };
}

/** The container holding `url`, or null at the root of its origin. */
function parentOf(url: string): string | null {
  const parsed = new URL(url);
  if (parsed.pathname === "/") return null;
  const path = parsed.pathname.endsWith("/") ? parsed.pathname.slice(0, -1) : parsed.pathname;
  return new URL(path.slice(0, path.lastIndexOf("/") + 1), parsed).href;
}

/**
 * The nearest ancestor's .acl, whose acl:default rules apply to a resource
 * that has no .acl of its own. Found through each ancestor's Link rel="acl".
 */
async function inheritedAcl(
  resourceUrl: string,
  fetchFn: typeof fetch,
): Promise<{ container: string; document: AclDocument; missing: string[] }> {
  const missing: string[] = []; // nearer ancestors' .acl URLs, which don't exist
  // A storage root must have its own .acl, so it inherits nothing from above.
  const self = await fetchFn(resourceUrl, { method: "HEAD", redirect: "error" });
  if (!self.ok || linkTargets(self, "type", resourceUrl).includes(PIM_STORAGE)) {
    throw new Error("Couldn't find the access rules that apply to this item.");
  }
  for (let container = parentOf(resourceUrl); container; container = parentOf(container)) {
    const head = await fetchFn(container, { method: "HEAD", redirect: "error" });
    if (!head.ok) throw new Error(`Couldn't find the access rules that apply to this item (${head.status}).`);
    const [aclUrl] = linkTargets(head, "acl", container);
    if (!aclUrl) throw new Error("Couldn't find the access rules that apply to this item.");
    assertBeside(aclUrl, container);
    const document = await loadAcl(aclUrl, fetchFn);
    if (document) return { container, document, missing };
    // A storage root must have its own .acl; never look above it.
    if (linkTargets(head, "type", container).includes(PIM_STORAGE)) break;
    missing.push(aclUrl);
  }
  throw new Error("Couldn't find the access rules that apply to this item.");
}

/** Rules in the document targeting the resource, through acl:accessTo or acl:default. */
function rulesAbout(store: Store, resourceUrl: string): Quad_Subject[] {
  const target = namedNode(resourceUrl);
  const rules = TARGETS.flatMap((p) => store.getSubjects(p, target, null));
  return rules.filter((rule, i) => rules.findIndex((other) => other.equals(rule)) === i);
}

/** A rule the app may edit: Read/Write/Append only, no origin restriction. */
function isShareableRule(store: Store, rule: Quad_Subject): boolean {
  const modes = store.getObjects(rule, MODE, null);
  return (
    modes.length > 0 &&
    modes.every((mode) => SHAREABLE_MODES.has(mode.value)) &&
    store.countQuads(rule, ORIGIN, null, null) === 0
  );
}

function names(store: Store, rule: Quad_Subject, who: NamedNode): boolean {
  return WHO.some((p) => store.has(quad(rule, p, who)));
}

/**
 * Copies the nearest ancestor's inherited (acl:default) rules into a new .acl
 * for the resource. Without them, creating the .acl would cut everyone off,
 * the owner included. Refuses if no inherited rule grants Control.
 */
function fromInherited(resourceUrl: string, aclUrl: string, inherited: { container: string; document: AclDocument }): AclDocument {
  const source = inherited.document.store;
  const store = new Store();
  const target = namedNode(resourceUrl);
  source.getSubjects(DEFAULT, namedNode(inherited.container), null).forEach((rule, i) => {
    const copy = namedNode(`${aclUrl}#inherited-${i + 1}`);
    store.addQuads(
      source
        .getQuads(rule, null, null, null)
        .filter((q) => !TARGETS.some((p) => p.equals(q.predicate)))
        .map((q) => quad(copy, q.predicate, q.object)),
    );
    store.addQuad(quad(copy, ACCESS_TO, target));
    if (resourceUrl.endsWith("/")) store.addQuad(quad(copy, DEFAULT, target));
  });
  if (!inherited.document.etag) {
    // Without one, a change to those rules before we save couldn't be noticed.
    throw new Error("This server doesn't support safely copying the inherited sharing settings, so nothing was changed.");
  }
  if (store.countQuads(null, MODE, acl("Control"), null) === 0) {
    throw new Error("Couldn't keep the existing control over this item, so nothing was changed.");
  }
  return { url: aclUrl, store, etag: null };
}

interface EditableAcl {
  document: AclDocument;
  /** For a new .acl: the ancestor .acl its rules were copied from, and the nearer ones that didn't exist. */
  copiedFrom: { source: AclDocument; missing: string[] } | null;
}

/** This resource's .acl, or a new one starting from the inherited rules. */
async function editableAcl(resourceUrl: string, aclUrl: string, fetchFn: typeof fetch): Promise<EditableAcl> {
  assertBeside(aclUrl, resourceUrl);
  const own = await loadAcl(aclUrl, fetchFn);
  if (own) return { document: own, copiedFrom: null };
  const inherited = await inheritedAcl(resourceUrl, fetchFn);
  return {
    document: fromInherited(resourceUrl, aclUrl, inherited),
    copiedFrom: { source: inherited.document, missing: inherited.missing },
  };
}

/**
 * Saves the edited .acl, guarded by its ETag. A new one is created only if
 * none appeared meanwhile, the ancestor .acl it copied still has the same
 * ETag, and no nearer ancestor has gained an .acl, so a rule revoked just now
 * isn't brought back here. (HTTP can't make the write itself conditional on
 * other documents, so these checks narrow that window rather than close it.)
 */
async function saveEditable(aclUrl: string, { document, copiedFrom }: EditableAcl, fetchFn: typeof fetch): Promise<void> {
  const body = await serialise(document.store);
  if (copiedFrom) {
    const changed = new Error("The sharing settings were changed by someone else just now. Please try again.");
    const check = await fetchFn(copiedFrom.source.url, { method: "HEAD", headers: { Accept: "text/turtle" }, redirect: "error" });
    if (!check.ok || check.headers.get("ETag") !== copiedFrom.source.etag) throw changed;
    for (const url of copiedFrom.missing) {
      if ((await fetchFn(url, { method: "HEAD", redirect: "error" })).status !== 404) throw changed;
    }
  }
  await saveAcr(aclUrl, body, copiedFrom ? "new" : { etag: document.etag }, fetchFn);
}

/**
 * Makes `rule` target only this resource: if it also targets other resources,
 * those keep an unchanged copy, so editing it here can't change access there.
 */
function isolate(store: Store, rule: Quad_Subject, resourceUrl: string): void {
  const target = namedNode(resourceUrl);
  const others = store.getQuads(rule, null, null, null).filter((q) => TARGETS.some((p) => p.equals(q.predicate)) && !q.object.equals(target));
  if (others.length === 0) return;
  const copy = namedNode(`${rule.value.split("#")[0]}#rule-${crypto.randomUUID()}`);
  const keep = (q: Quad) => !TARGETS.some((p) => p.equals(q.predicate)) || !q.object.equals(target);
  store.addQuads(store.getQuads(rule, null, null, null).filter(keep).map((q) => quad(copy, q.predicate, q.object)));
  store.removeQuads(others);
}

/**
 * Takes `who` out of the shareable rules about the resource. A rule that also
 * names others keeps them; a rule naming only `who` is deleted. Returns
 * whether anything changed.
 */
function removeWho(store: Store, resourceUrl: string, webId: string): boolean {
  const who = namedNode(webId);
  let changed = false;
  for (const rule of rulesAbout(store, resourceUrl)) {
    if (!isShareableRule(store, rule) || !names(store, rule, who)) continue;
    isolate(store, rule, resourceUrl);
    const everyone = WHO.flatMap((p) => store.getQuads(rule, p, null, null));
    if (everyone.some((q) => !q.object.equals(who))) {
      store.removeQuads(everyone.filter((q) => q.object.equals(who)));
    } else {
      store.removeQuads(store.getQuads(rule, null, null, null));
    }
    changed = true;
  }
  return changed;
}

/** Whether `webId` has access here the app can't replace with a plain rule (Control, origin limits). */
function hasUnmanagedRule(store: Store, resourceUrl: string, webId: string): boolean {
  const who = namedNode(webId);
  return rulesAbout(store, resourceUrl).some((rule) => names(store, rule, who) && !isShareableRule(store, rule));
}

/** Whether a rule for everyone (or every signed-in person) already allows writing to the resource. */
function everyoneCanWrite(store: Store, resourceUrl: string): boolean {
  return rulesAbout(store, resourceUrl).some(
    (rule) =>
      EVERYONE.some((who) => store.has(quad(rule, acl("agentClass"), who))) &&
      ["Write", "Append"].some((mode) => store.has(quad(rule, MODE, acl(mode)))),
  );
}

function addRule(document: AclDocument, resourceUrl: string, webId: string, modes: AccessMode[]): void {
  const rule = namedNode(`${document.url.split("#")[0]}#share-${crypto.randomUUID()}`);
  const target = namedNode(resourceUrl);
  document.store.addQuads([
    quad(rule, RDF_TYPE, acl("Authorization")),
    quad(rule, AGENT, namedNode(webId)),
    quad(rule, ACCESS_TO, target),
    ...(resourceUrl.endsWith("/") ? [quad(rule, DEFAULT, target)] : []),
    ...modes.map((mode) => quad(rule, MODE, acl(mode))),
  ]);
}

function serialise(store: Store): Promise<string> {
  return new Promise((resolve, reject) => {
    const writer = new Writer({ prefixes: { acl: ACL, foaf: "http://xmlns.com/foaf/0.1/" } });
    writer.addQuads(store.getQuads(null, null, null, null));
    writer.end((error, result) => (error ? reject(error) : resolve(result)));
  });
}

/**
 * Gives each WebID exactly `accessLevel` on the resource (and, for a folder,
 * its contents), replacing their earlier plain rules. Creates the .acl from
 * the inherited rules if there isn't one. Refuses to change `ownWebId`'s
 * access, or access the app can't represent (Control, origin limits).
 */
export async function shareResourceWithWac(
  resourceUrl: string,
  aclUrl: string,
  webIds: string[],
  accessLevel: AccessLevel,
  fetchFn: typeof fetch,
  ownWebId: string | undefined,
): Promise<void> {
  if (webIds.length === 0) return;
  if (ownWebId && webIds.includes(ownWebId)) throw new OwnAccessError();

  const editable = await editableAcl(resourceUrl, aclUrl, fetchFn);
  const { document } = editable;
  const unmanaged = webIds.find((webId) => hasUnmanagedRule(document.store, resourceUrl, webId));
  if (unmanaged) throw new UnmanagedAccessError(unmanaged);
  if (accessLevel === "Viewer" && everyoneCanWrite(document.store, resourceUrl)) {
    throw new Error("Everyone can already edit this item, so nobody can be limited to viewing it here.");
  }

  for (const webId of new Set(webIds)) {
    removeWho(document.store, resourceUrl, webId);
    addRule(document, resourceUrl, webId, LEVEL_MODES[accessLevel]);
  }
  await saveEditable(aclUrl, editable, fetchFn);
}

/**
 * Who has access to the resource and with which modes: from its own .acl
 * (rules targeting it through acl:accessTo or, for a folder's contents,
 * acl:default), or else from the nearest ancestor's acl:default rules.
 */
export async function getWacAccessList(resourceUrl: string, aclUrl: string, fetchFn: typeof fetch): Promise<AccessEntry[]> {
  assertBeside(aclUrl, resourceUrl);
  const own = await loadAcl(aclUrl, fetchFn);
  const inherited = own ? null : await inheritedAcl(resourceUrl, fetchFn);
  const store = own?.store ?? inherited!.document.store;
  const rules = own
    ? rulesAbout(store, resourceUrl)
    : store.getSubjects(DEFAULT, namedNode(inherited!.container), null);

  const entries = new Map<string, { modes: Set<AccessMode>; canRemove: boolean }>();
  for (const rule of rules) {
    const modes = store
      .getObjects(rule, MODE, null)
      .map((mode) => MODES.find((m) => ACL + m === mode.value))
      .filter((mode): mode is AccessMode => mode !== undefined);
    if (modes.length === 0) continue;
    for (const who of WHO.flatMap((p) => store.getObjects(rule, p, null))) {
      const entry = entries.get(who.value) ?? { modes: new Set<AccessMode>(), canRemove: true };
      modes.forEach((mode) => entry.modes.add(mode));
      entry.canRemove &&= isShareableRule(store, rule);
      entries.set(who.value, entry);
    }
  }
  return [...entries].map(([webId, { modes, canRemove }]) => ({
    webId,
    accessModes: MODES.filter((mode) => modes.has(mode)),
    canRemove,
  }));
}

/**
 * Removes the access the app can manage for `webIdToRemove`. On a resource
 * without its own .acl, this creates one from the inherited rules, minus them.
 */
export async function removeAccessWithWac(
  resourceUrl: string,
  aclUrl: string,
  webIdToRemove: string,
  fetchFn: typeof fetch,
  ownWebId: string | undefined,
): Promise<void> {
  if (ownWebId && webIdToRemove === ownWebId) throw new OwnAccessError();

  const editable = await editableAcl(resourceUrl, aclUrl, fetchFn);
  const { document } = editable;
  if (!removeWho(document.store, resourceUrl, webIdToRemove)) return;
  await saveEditable(aclUrl, editable, fetchFn);
}
