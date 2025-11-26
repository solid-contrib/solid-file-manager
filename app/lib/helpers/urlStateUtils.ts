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

