/**
 * Storage URLs the user entered by hand, for servers whose WebID profile does
 * not list its storage (e.g. ESS 3 at the moment). Kept per WebID in this
 * browser only; they are plain URLs, never tokens.
 */

const KEY_PREFIX = "solid-file-manager-storages:";

/** Normalises a typed storage URL, or explains why it is not usable. */
export function normaliseStorageUrl(input: string): { url: string } | { error: string } {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return { error: "Enter a full URL, starting with https://" };
  }
  const isLocal = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (url.protocol !== "https:" && !(url.protocol === "http:" && isLocal)) {
    return { error: "The storage URL must start with https://" };
  }
  url.hash = "";
  url.search = "";
  return { url: url.href.endsWith("/") ? url.href : `${url.href}/` };
}

/**
 * Explains why a response to a storage URL is not a usable Solid storage
 * folder, or returns null when it is (an LDP container, or at least RDF).
 */
export function storageProblem(response: Response): string | null {
  if (response.status === 401 || response.status === 403) return "You don't have access to that storage.";
  if (!response.ok) return `No storage found at that URL (${response.status}).`;
  const links = response.headers.get("Link") ?? "";
  const isContainer = /<http:\/\/www\.w3\.org\/ns\/ldp#(Basic)?Container>\s*;\s*rel="type"/.test(links);
  const isRdf = /text\/turtle|application\/ld\+json/.test(response.headers.get("Content-Type") ?? "");
  return isContainer || isRdf ? null : "That URL isn't a Solid storage folder.";
}

export function loadManualStorages(webId: string): string[] {
  try {
    const stored = JSON.parse(localStorage.getItem(KEY_PREFIX + webId) ?? "[]");
    return Array.isArray(stored) ? stored.filter((url): url is string => typeof url === "string") : [];
  } catch {
    return [];
  }
}

export function saveManualStorage(webId: string, url: string): string[] {
  const urls = [...new Set([...loadManualStorages(webId), url])];
  try {
    localStorage.setItem(KEY_PREFIX + webId, JSON.stringify(urls));
  } catch {
    // Storage unavailable (e.g. private browsing): it still works for this visit.
  }
  return urls;
}
