/**
 * Utilities for managing URL state and sessionStorage synchronization
 * Handles encoding/decoding URLs and syncing with browser URL params and sessionStorage
 */

const STORAGE_KEY = "solid-file-manager-url";

/**
 * Safely decodes a URL-encoded string, returning original if decode fails
 */
export function safeDecodeUrl(url: string): string {
    try {
        return decodeURIComponent(url);
    } catch {
        return url;
    }
}

/**
 * Safely encodes a URL string
 */
export function safeEncodeUrl(url: string): string {
    return encodeURIComponent(url);
}

/**
 * Gets the URL parameter from the current browser URL
 */
export function getUrlFromSearchParams(): string | null {
    if (typeof window === "undefined") return null;

    try {
        const urlParam = new URLSearchParams(window.location.search).get("url");
        return urlParam ? safeDecodeUrl(urlParam) : null;
    } catch {
        return null;
    }
}

/**
 * Gets the URL from sessionStorage
 */
export function getUrlFromStorage(): string | null {
    if (typeof window === "undefined") return null;

    try {
        return sessionStorage.getItem(STORAGE_KEY);
    } catch {
        return null;
    }
}

/**
 * Saves URL to sessionStorage
 */
export function saveUrlToStorage(url: string): void {
    if (typeof window === "undefined") return;

    sessionStorage.setItem(STORAGE_KEY, url);

}

/**
 * Removes URL from sessionStorage
 */
export function removeUrlFromStorage(): void {
    if (typeof window === "undefined") return;

    sessionStorage.removeItem(STORAGE_KEY);
}


/**
 * The storage a URL from `?url=` (or sessionStorage) belongs to, with the URL
 * normalised. It must parse as http(s) without credentials, share the
 * storage's origin, and lie inside the storage's path once dot segments
 * (also percent-encoded ones) are resolved; the most specific storage wins.
 * Null otherwise, so a crafted link can't point the app outside the storages.
 */
export function findStorageFor<T extends { url: string }>(
    candidate: string,
    storages: T[],
): { storage: T; url: string; isRoot: boolean } | null {
    let target: URL;
    try {
        target = new URL(candidate);
    } catch {
        return null;
    }
    if (!["http:", "https:"].includes(target.protocol) || target.username || target.password) return null;
    target.hash = "";

    let best: { storage: T; url: string; isRoot: boolean; depth: number } | null = null;
    for (const storage of storages) {
        let root: URL;
        try {
            root = new URL(storage.url);
        } catch {
            continue;
        }
        const rootPath = root.pathname.endsWith("/") ? root.pathname : `${root.pathname}/`;
        const isRoot = target.pathname === root.pathname || target.pathname === rootPath;
        if (target.origin !== root.origin || !(isRoot || target.pathname.startsWith(rootPath))) continue;
        if (!best || rootPath.length > best.depth) best = { storage, url: target.href, isRoot, depth: rootPath.length };
    }
    return best && { storage: best.storage, url: best.url, isRoot: best.isRoot };
}
