const ACP_ACR_TYPE = "http://www.w3.org/ns/solid/acp#AccessControlResource";

/**
 * - `acp`: an ACP access control resource (Community Solid Server, ESS).
 * - `wac`: a WAC .acl (e.g. solidcommunity.net).
 * - `restricted`: the server refused to show the document, so we can't tell
 *   (ESS only reveals the ACP type once you may manage access).
 */
export type AccessControlKind = "acp" | "wac" | "restricted";

export interface AccessControlInfo {
  kind: AccessControlKind;
  /** The resource's access-control document (ACP: its ACR; WAC: its .acl). */
  url: string;
}

/** Thrown when sharing can't go ahead on this resource. */
export class UnsupportedAccessControlError extends Error {
  constructor(readonly kind: Exclude<AccessControlKind, "acp"> | "none") {
    super(
      kind === "wac"
        ? "Sharing isn't supported on this server yet (it uses WAC)."
        : kind === "restricted"
          ? "You don't have permission to manage sharing for this item."
          : "This server doesn't offer access control for this resource.",
    );
    this.name = "UnsupportedAccessControlError";
  }
}

/**
 * The targets of every Link header entry with the given relation, resolved
 * against `base`. Respects quoted parameter values (which may hold , and ;).
 */
export function linkTargets(response: Response, rel: string, base: string): string[] {
  const header = response.headers.get("Link") ?? "";
  const targets: string[] = [];
  let i = 0;
  while (i < header.length) {
    const open = header.indexOf("<", i);
    if (open === -1) break;
    const close = header.indexOf(">", open);
    if (close === -1) break;
    const target = header.slice(open + 1, close);
    // Parameters run until a comma outside quotes.
    let j = close + 1;
    let inQuotes = false;
    while (j < header.length && (inQuotes || header[j] !== ",")) {
      if (header[j] === '"' && header[j - 1] !== "\\") inQuotes = !inQuotes;
      j += 1;
    }
    if (relationsOf(header.slice(close + 1, j)).includes(rel)) targets.push(new URL(target, base).href);
    i = j + 1;
  }
  return targets;
}

/** The values of the `rel` parameter in `; a=b; rel="x y"`, ignoring anything inside other quoted values. */
function relationsOf(params: string): string[] {
  const parts: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let k = 0; k < params.length; k += 1) {
    const ch = params[k];
    if (ch === '"' && params[k - 1] !== "\\") inQuotes = !inQuotes;
    if (ch === ";" && !inQuotes) {
      parts.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  parts.push(current);
  for (const part of parts) {
    const eq = part.indexOf("=");
    if (eq === -1 || part.slice(0, eq).trim().toLowerCase() !== "rel") continue;
    return part.slice(eq + 1).trim().replace(/^"|"$/g, "").split(/\s+/).filter(Boolean);
  }
  return [];
}

/**
 * Finds a resource's access-control document from its `Link: rel="acl"`
 * header (never by guessing URLs), and what kind it is. An ACP server types it
 * acp:AccessControlResource; a document we may read (or that doesn't exist
 * yet) without that type is WAC; a refusal without it can't be classified.
 * Returns null when the server advertises none.
 */
export async function discoverAccessControl(
  resourceUrl: string,
  fetchFn: typeof fetch,
): Promise<AccessControlInfo | null> {
  const resource = await fetchFn(resourceUrl, { method: "HEAD" });
  const [url] = linkTargets(resource, "acl", resource.url || resourceUrl);
  if (!url) {
    // Only a working response without the header means "no access control".
    if (!resource.ok) throw new Error(`Couldn't check the resource (${resource.status}).`);
    return null;
  }

  const document = await fetchFn(url, { method: "HEAD" });
  if (linkTargets(document, "type", url).includes(ACP_ACR_TYPE)) return { kind: "acp", url };
  if (document.status === 401 || document.status === 403) return { kind: "restricted", url };
  if (document.ok || document.status === 404) return { kind: "wac", url };
  throw new Error(`Couldn't check the access control document (${document.status}).`);
}
