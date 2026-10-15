// Solid has no server-side move, so moving is copy-then-delete.

import { deleteFile, getFile, UrlString } from "@inrupt/solid-client";
import { decodeResourceNameFromUrl } from "./copyUtils";
import { getHttpStatus } from "./httpErrorUtils";
import {
    createResourceWithSlug,
    isIndeterminateWriteError,
    type SlugWriteResult,
} from "./slugUtils";

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

    const fileBlob = await getFile(file.url as UrlString, { fetch: fetchFn });
    const contentType =
        fileBlob.type || file.mimeType || "application/octet-stream";

    let written: SlugWriteResult;
    try {
        written = await createResourceWithSlug(
            destinationFolderUrl,
            fileBlob,
            requestedName,
            contentType,
            fetchFn,
        );
    } catch (error) {
        if (isIndeterminateWriteError(error)) {
            throw new IndeterminateMoveError(destinationFolderUrl, error);
        }
        throw error;
    }

    return {
        url: written.url,
        name: written.name,
        requestedName,
        originalName,
        sourceRemoved: await deleteSource(file.url, fetchFn),
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
