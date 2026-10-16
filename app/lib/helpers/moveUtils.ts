// Solid has no server-side move, so moving is copy-then-delete.

import { deleteFile, getFile, overwriteFile, UrlString } from "@inrupt/solid-client";
import { loadContainerListing } from "../cache";
import { fetchContainerListing } from "./containerListingUtils";
import { decodeResourceNameFromUrl } from "./copyUtils";
import { getHttpStatus } from "./httpErrorUtils";
import {
    createResourceWithSlug,
    isIndeterminateWriteError,
    isNameConflictError,
    type SlugWriteResult,
} from "./slugUtils";

const MAX_KEEP_BOTH_ATTEMPTS = 100;

export interface MoveResult {
    /** Where the resource actually ended up. */
    url: string;
    /** What the server actually called it. */
    name: string;
    /** The name we asked the server for. */
    requestedName: string;
    /** What the resource was called before the move. */
    originalName: string;
    /** False when the original could not be removed, so both copies now exist. */
    sourceRemoved: boolean;
}


export interface MoveConflict {
    existingName: string;
    targetUrl: string;
}

export type MoveConflictChoice = "replace" | "keepBoth";

/**
 * Thrown when a write may or may not have reached the destination.
 */
export class IndeterminateMoveError extends Error {
    readonly destinationFolderUrl: string;

    constructor(destinationFolderUrl: string, cause: unknown) {
        super("Could not confirm whether the file reached the destination.", {
            cause,
        });
        this.name = "IndeterminateMoveError";
        this.destinationFolderUrl = destinationFolderUrl;
    }
}

/**
 * Look for a resource already using requestedName at the destination, so the
 * user can be asked before any bytes are transferred.
 */
export async function findMoveConflict(
    destinationFolderUrl: string,
    requestedName: string,
    fetchFn: typeof fetch,
): Promise<MoveConflict | null> {
    const listing = await loadContainerListing(destinationFolderUrl, () =>
        fetchContainerListing(destinationFolderUrl, fetchFn),
    );

    const existing = listing.find((item) => item.name === requestedName);
    return existing
        ? { existingName: existing.name, targetUrl: existing.url }
        : null;
}

/**
 * Move a file into another container, optionally under a new name.
 *
 * The delete only runs once the write has been confirmed, so a failed or
 * unconfirmed write always leaves the original intact.
 */
export async function moveFileResource(
    file: { url: string; name?: string; mimeType?: string },
    destinationFolderUrl: string,
    fetchFn: typeof fetch,
    newName?: string,
): Promise<MoveResult> {
    const originalName = file.name ?? decodeResourceNameFromUrl(file.url);
    const requestedName = newName?.trim() || originalName;
    const { body, contentType } = await readSource(file, fetchFn);

    const written = await writeOrFlagIndeterminate(destinationFolderUrl, () =>
        createResourceWithSlug(
            destinationFolderUrl,
            body,
            requestedName,
            contentType,
            fetchFn,
        ),
    );

    return completeMove(written, requestedName, originalName, file.url, fetchFn);
}

/** Move a file when the user has decided how to resolve a name clash. */
export async function moveFileWithConflictChoice(
    file: { url: string; name?: string; mimeType?: string },
    destinationFolderUrl: string,
    newName: string,
    conflict: MoveConflict,
    choice: MoveConflictChoice,
    fetchFn: typeof fetch,
): Promise<MoveResult> {
    const originalName = file.name ?? decodeResourceNameFromUrl(file.url);
    const requestedName = newName?.trim() || originalName;
    const { body, contentType } = await readSource(file, fetchFn);

    const written =
        choice === "replace"
            ? await writeOrFlagIndeterminate(destinationFolderUrl, async () => {
                await overwriteFile(conflict.targetUrl as UrlString, body, {
                    contentType,
                    fetch: fetchFn,
                });
                // We wrote over a resource we had already located, so the name is exact.
                return {
                    url: conflict.targetUrl,
                    name: conflict.existingName,
                    slugRespected: true,
                };
            })
            : await createKeepingBoth(
                destinationFolderUrl,
                body,
                requestedName,
                contentType,
                fetchFn,
            );

    return completeMove(written, requestedName, originalName, file.url, fetchFn);
}

/** Read the resource being moved, with the content type to write it back under. */
async function readSource(
    file: { url: string; mimeType?: string },
    fetchFn: typeof fetch,
): Promise<{ body: Blob; contentType: string }> {
    const body = await getFile(file.url as UrlString, { fetch: fetchFn });
    return {
        body,
        contentType: body.type || file.mimeType || "application/octet-stream",
    };
}

/** Create under "name (1)", "name (2)" and so on, since the plain name is taken. */
async function createKeepingBoth(
    destinationFolderUrl: string,
    body: Blob,
    requestedName: string,
    contentType: string,
    fetchFn: typeof fetch,
): Promise<SlugWriteResult> {
    const lastDot = requestedName.lastIndexOf(".");
    const base = lastDot > 0 ? requestedName.slice(0, lastDot) : requestedName;
    const ext = lastDot > 0 ? requestedName.slice(lastDot) : "";

    for (let attempt = 1; attempt <= MAX_KEEP_BOTH_ATTEMPTS; attempt += 1) {
        try {
            return await writeOrFlagIndeterminate(destinationFolderUrl, () =>
                createResourceWithSlug(
                    destinationFolderUrl,
                    body,
                    `${base} (${attempt})${ext}`,
                    contentType,
                    fetchFn,
                ),
            );
        } catch (error) {
            if (!isNameConflictError(error)) {
                throw error;
            }
        }
    }

    throw new Error(`Could not find a free name based on "${requestedName}".`);
}

/** Convert a write we cannot account for into a signal not to touch the source. */
async function writeOrFlagIndeterminate(
    destinationFolderUrl: string,
    write: () => Promise<SlugWriteResult>,
): Promise<SlugWriteResult> {
    try {
        return await write();
    } catch (error) {
        if (isIndeterminateWriteError(error)) {
            throw new IndeterminateMoveError(destinationFolderUrl, error);
        }
        throw error;
    }
}

/** Remove the original now the copy is confirmed, and report what happened. */
async function completeMove(
    written: SlugWriteResult,
    requestedName: string,
    originalName: string,
    sourceUrl: string,
    fetchFn: typeof fetch,
): Promise<MoveResult> {
    return {
        url: written.url,
        name: written.name,
        requestedName,
        originalName,
        sourceRemoved: await deleteSource(sourceUrl, fetchFn),
    };
}

/**
 * Remove the resource we copied from.
 */
async function deleteSource(
    url: string,
    fetchFn: typeof fetch,
): Promise<boolean> {
    try {
        await deleteFile(url as UrlString, { fetch: fetchFn });
        return true;
    } catch (error) {
        if (getHttpStatus(error) === 404) {
            return true;
        }
        console.warn(`Could not remove the original after moving ${url}:`, error);
        return false;
    }
}
