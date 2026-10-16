// Helpers for the name (slug) a Solid server assigns to a resource.
// A server may honour a requested slug, adapt it, or ignore it entirely,
// so the name a resource ends up with has to be read back, never assumed.
import { getSourceUrl, saveFileInContainer } from "@inrupt/solid-client";
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

export interface SlugWriteResult {
    /** Where the resource actually landed. */
    url: string;
    /** What the server actually called it. */
    name: string;
    /** False when the server chose a name other than the one we asked for. */
    slugRespected: boolean;
}

// only encode when the raw name would be an invalid header value.
function toHeaderSafeSlug(name: string): string {
    return /^[\x20-\x7E]+$/.test(name) ? name : encodeURIComponent(name);
}

/**
 * Create a resource inside a container under a requested name.
 * The server is free to pick a different name, so the result reports what it actually used.
 */
export async function createResourceWithSlug(
    containerUrl: string,
    body: Blob,
    requestedName: string,
    contentType: string,
    fetchFn: typeof fetch,
): Promise<SlugWriteResult> {
    const saved = await saveFileInContainer(containerUrl, body, {
        slug: toHeaderSafeSlug(requestedName),
        contentType,
        fetch: fetchFn,
    });

    const url = getSourceUrl(saved);
    const name = nameFromSavedUrl(url, containerUrl);

    return { url, name, slugRespected: name === requestedName };
}

/**
 * True when a failed write leaves us unable to say whether anything was created,
 * so a caller must not delete the resource it was copying from.
 */
export function isIndeterminateWriteError(error: unknown): boolean {
    return getHttpStatus(error) === undefined;
}
