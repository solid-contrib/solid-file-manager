import { getHttpStatus } from "./httpErrorUtils";
import { IndeterminateMoveError, type MoveResult } from "./moveUtils";

export interface MoveMessage {
    title: string;
    type: "success" | "warning" | "error";
}

/**
 * Describes what actually happened, which is not always what was asked for;
 * the server may rename the resource, ignore a rename, or refuse to let go of
 * the original.
 */
export function describeMoveResult(result: MoveResult): MoveMessage {
    // Worst case first: the copy landed but the pod now holds two of them.
    if (!result.sourceRemoved) {
        return {
            title: `Copied "${result.name}", but the original could not be removed. Both copies now exist.`,
            type: "error",
        };
    }

    if (result.name === result.requestedName) {
        return { title: `Moved "${result.name}"`, type: "success" };
    }

    // A rename was asked for and the old name stuck, so the move landed but the
    // rename did not.
    if (
        result.requestedName !== result.originalName &&
        result.name === result.originalName
    ) {
        return {
            title: `Moved, but the name was not changed. It is still "${result.originalName}".`,
            type: "warning",
        };
    }

    return { title: `Moved as "${result.name}"`, type: "success" };
}

/** Maps a failed move to something the user can act on. */
export function describeMoveError(error: unknown): MoveMessage {
    // The write may have landed, so the original was deliberately kept.
    if (error instanceof IndeterminateMoveError) {
        return {
            title:
                "Could not confirm the move. Check the destination folder before trying again — the original has been left in place.",
            type: "warning",
        };
    }

    const status = getHttpStatus(error);

    switch (status) {
        case 401:
        case 403:
            return {
                title:
                    "You do not have permission to write to that folder. Nothing was moved.",
                type: "error",
            };
        case 404:
            return {
                title:
                    "The file or the destination folder no longer exists. Nothing was moved.",
                type: "error",
            };
        case 409:
        case 412:
            return {
                title:
                    "Something else took that name just now. Try again. Nothing was moved.",
                type: "error",
            };
        case 413:
            return {
                title: "The file is too large for that destination. Nothing was moved.",
                type: "error",
            };
        case 415:
            return {
                title:
                    "The server rejected the file's content type. Nothing was moved.",
                type: "error",
            };
        case 507:
            return {
                title: "There is not enough space in that storage. Nothing was moved.",
                type: "error",
            };
    }

    if (status === undefined) {
        return {
            title: "Could not reach the server. Nothing was moved.",
            type: "error",
        };
    }

    return {
        title:
            error instanceof Error
                ? `Failed to move: ${error.message}`
                : "Failed to move file",
        type: "error",
    };
}
