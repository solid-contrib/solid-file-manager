// Helpers for the name (slug) a Solid server assigns to a resource.
// A server may honour a requested slug, adapt it, or ignore it entirely,
// so the name a resource ends up with has to be read back, never assumed.
import { ensureTrailingSlash } from "./copyUtils";
import { getHttpStatus } from "./httpErrorUtils";

/** True when the server refused to create a resource because the name is taken. */
export function isNameConflictError(error: unknown): boolean {
    const status = getHttpStatus(error);
    return status === 412 || status === 409;
}

/** Last path segment of the URL the server actually created. */
export function nameFromSavedUrl(
    sourceUrl: string,
    containerUrl: string,
): string {
    const parent = ensureTrailingSlash(containerUrl);
    if (sourceUrl.startsWith(parent)) {
        return decodeURIComponent(sourceUrl.slice(parent.length).replace(/\/$/, ""));
    }
    try {
        const segments = new URL(sourceUrl).pathname.split("/").filter(Boolean);
        return decodeURIComponent(segments[segments.length - 1] ?? sourceUrl);
    } catch {
        return sourceUrl;
    }
}
