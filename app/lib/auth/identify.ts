import { DataFactory, Parser, Store } from "n3";
import { WebIdDataset } from "@/app/lib/class/WebIdDataset";
import { fetchDiscovery } from "./discovery";
import { LOOPBACK_HOSTS } from "./manager";

const TIMEOUT_MS = 8000;

export type LoginTarget =
  | { kind: "webid"; webId: string; issuers: string[] }
  | { kind: "issuer"; issuer: string }
  | { kind: "unknown" };

/**
 * Works out whether the user typed a WebID or a login server, by asking both
 * questions at once rather than guessing from the URL's shape 
 */
export async function identify(input: string): Promise<LoginTarget> {
  for (const url of candidateUrls(input)) {
    const target = await identifyOne(url);
    if (target.kind !== "unknown") return target;
  }
  return { kind: "unknown" };
}

async function identifyOne(url: string): Promise<LoginTarget> {
  // The profile goes first so a WebID that names its issuer never triggers the
  // discovery request, which would 404 and litter the console on every login.
  const issuers = await probeProfile(url);
  if (issuers?.length) return { kind: "webid", webId: url, issuers };

  // An issuer identifier carries no fragment (OIDC Discovery §3), so a WebID
  // ending in #me is not worth asking about — the request would 404, or 401 on
  // a server that protects the whole path.
  //
  // A CSS pod root parses as Turtle with no issuer in it, so discovery has to
  // win over an empty profile or the root would be mistaken for a WebID.
  const discovery = url.includes("#") ? null : await fetchDiscovery(url);
  if (discovery) return { kind: "issuer", issuer: discovery.issuer };

  if (issuers) return { kind: "webid", webId: url, issuers: [] };
  return { kind: "unknown" };
}

/**
 * The URLs worth trying for one input.
 *
 * A bare host gets https, except on loopback: a local Community Solid Server
 * serves plain HTTP, so defaulting to TLS there just fails to connect. Both
 * schemes are tried for loopback, http first, whichever was typed.
 */
function candidateUrls(input: string): string[] {
  const trimmed = input.trim();
  if (!trimmed) return [];

  const scheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  let url: URL;
  try {
    url = new URL(scheme);
  } catch {
    return [];
  }

  if (!LOOPBACK_HOSTS.has(url.hostname)) return [url.href];

  const insecure = new URL(url.href);
  insecure.protocol = "http:";
  const secure = new URL(url.href);
  secure.protocol = "https:";
  return [insecure.href, secure.href];
}

/**
 * Returns the issuers named by a WebID profile, an empty array when the
 * document is a profile we cannot read the issuers from, or null when it is not
 * a profile at all.
 */
async function probeProfile(webId: string): Promise<string[] | null> {
  let response: Response;
  try {
    response = await fetch(webId, {
      headers: { accept: "text/turtle" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    return null;
  }

  // A profile we are not allowed to read is still a profile. The login page
  // asks for the issuer instead of giving up.
  if (response.status === 401 || response.status === 403) return [];
  if (!response.ok) return null;

  try {
    const store = new Store();
    const parser = new Parser({ baseIRI: response.url || webId });
    store.addQuads(parser.parse(await response.text()));

    const agent = new WebIdDataset(store, DataFactory).mainSubject;
    return agent ? [...agent.oidcIssuers] : [];
  } catch {
    return null;
  }
}
