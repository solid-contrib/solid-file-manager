// Solid has no server-side rename, so renaming is copy-then-delete, like moving.

import { createContainerAt, getContainedResourceUrlAll, getSolidDataset, UrlString } from "@inrupt/solid-client";
import { decodeResourceNameFromUrl, ensureTrailingSlash, getParentContainerUrl } from "./copyUtils";
import { getHttpStatus } from "./httpErrorUtils";

/**
 * 412: something already has this name (If-None-Match: *). 409: Community
 * Solid Server's answer when a folder already exists, or the name is taken
 * by the other kind of resource (a file "x" and a folder "x/").
 */
const NAME_TAKEN = new Set([409, 412]);

/** Thrown when something already uses the new name; nothing was changed. */
export class NameTakenError extends Error {
    constructor(readonly newName: string) {
        super(`A resource named "${newName}" already exists.`);
        this.name = "NameTakenError";
    }
}

export type KeptBecause = "changed" | "unverified" | "failed";

export interface RenameResult {
    /** Where the resource now is. */
    url: string;
    /** False when the original (or, for a folder, part of it) is still there. */
    sourceRemoved: boolean;
    /**
     * Why it is still there: someone changed it meanwhile, it couldn't be
     * checked for changes (no ETag), or removing it failed.
     */
    keptBecause?: KeptBecause;
}

/** A file that was copied, and the version of it that the copy holds. */
interface CopiedFile {
    url: string;
    etag: string | null;
}

/**
 * Renames a file or folder within its folder. Copies are only ever created,
 * never written over something that exists (If-None-Match: *); an original
 * file is only removed once its copy is confirmed and only if it is still the
 * version that was copied (If-Match); folders are only removed once empty.
 * Any failure before that leaves the original as it was.
 */
export async function renameResource(
    item: { url: string; mimeType?: string },
    newName: string,
    fetchFn: typeof fetch,
): Promise<RenameResult> {
    const isFolder = item.url.endsWith("/");
    const parent = ensureTrailingSlash(getParentContainerUrl(item.url));
    const newUrl = `${parent}${encodeURIComponent(newName)}${isFolder ? "/" : ""}`;

    if (!isFolder) {
        let copied: CopiedFile;
        try {
            copied = await copyFile(item.url, newUrl, item.mimeType, fetchFn);
        } catch (error) {
            if (NAME_TAKEN.has(getHttpStatus(error) ?? 0)) throw new NameTakenError(newName);
            throw error;
        }
        return { url: newUrl, ...outcome([await removeUnchangedFile(copied, fetchFn)]) };
    }

    try {
        await createContainerAt(newUrl as UrlString, { fetch: fetchFn });
    } catch (error) {
        if (NAME_TAKEN.has(getHttpStatus(error) ?? 0)) throw new NameTakenError(newName);
        throw error;
    }
    const files: CopiedFile[] = [];
    const folders: string[] = [ensureTrailingSlash(item.url)];
    try {
        await copyTree(item.url, newUrl, fetchFn, files, folders);
    } catch (error) {
        throw new Error(`Couldn't copy everything into "${newName}", so the original folder was kept.`, { cause: error });
    }

    const removals: (KeptBecause | null)[] = [];
    for (const file of files) removals.push(await removeUnchangedFile(file, fetchFn));
    // Folders go deepest first, and only if every file in them went: a server
    // won't delete a folder that isn't empty, so nothing added meanwhile is lost.
    const everyFileRemoved = !removals.some((kept) => kept !== null);
    if (everyFileRemoved) {
        for (const folder of [...folders].reverse()) removals.push(await removeFolder(folder, fetchFn));
    }
    return { url: newUrl, ...outcome(removals) };
}

function outcome(removals: (KeptBecause | null)[]): Pick<RenameResult, "sourceRemoved" | "keptBecause"> {
    const kept = removals.filter((reason): reason is KeptBecause => reason !== null);
    if (kept.length === 0) return { sourceRemoved: true };
    // Report the reason that most needs the user's attention.
    const keptBecause = (["changed", "unverified", "failed"] as const).find((reason) => kept.includes(reason))!;
    return { sourceRemoved: false, keptBecause };
}

/** Copies one file, creating (never replacing) the target, and returns the version copied. */
async function copyFile(sourceUrl: string, targetUrl: string, mimeType: string | undefined, fetchFn: typeof fetch): Promise<CopiedFile> {
    const source = await fetchFn(sourceUrl);
    if (!source.ok) throw new Error(`Couldn't read "${decodeResourceNameFromUrl(sourceUrl)}" (${source.status}).`);
    const etag = source.headers.get("ETag");
    const body = await source.blob();
    let response: Response;
    try {
        response = await fetchFn(targetUrl, {
            method: "PUT",
            headers: { "Content-Type": body.type || mimeType || "application/octet-stream", "If-None-Match": "*" },
            body,
        });
    } catch (error) {
        // The write may or may not have arrived, so the original must stay.
        throw new Error("Couldn't confirm the renamed copy was saved, so the original was kept.", { cause: error });
    }
    if (!response.ok) {
        throw Object.assign(new Error(`Couldn't save "${decodeResourceNameFromUrl(targetUrl)}" (${response.status}).`), {
            status: response.status,
        });
    }
    return { url: sourceUrl, etag };
}

/**
 * Whether `child` is directly inside `folder`: same origin, and one path
 * segment below it. A listing naming anything else isn't trusted, since
 * everything copied is deleted afterwards.
 */
function isDirectChild(child: string, folder: string): boolean {
    try {
        const c = new URL(child);
        const f = new URL(ensureTrailingSlash(folder));
        if (c.origin !== f.origin || !c.pathname.startsWith(f.pathname)) return false;
        const rest = c.pathname.slice(f.pathname.length);
        return rest.length > 0 && !rest.slice(0, -1).includes("/") && rest !== "/";
    } catch {
        return false;
    }
}

/** Copies a folder's contents into `target`, recording every file copied and every folder visited. */
async function copyTree(source: string, target: string, fetchFn: typeof fetch, files: CopiedFile[], folders: string[]) {
    const listing = await getSolidDataset(ensureTrailingSlash(source) as UrlString, { fetch: fetchFn });
    const children = getContainedResourceUrlAll(listing);
    // Check the whole listing before copying anything from it.
    const stranger = children.find((child) => !isDirectChild(child, source));
    if (stranger) throw new Error(`The folder listing names something outside the folder (${stranger}).`);
    for (const child of children) {
        // Access rules and metadata aren't copied (and so aren't deleted either).
        if (child.endsWith(".acl") || child.endsWith(".meta")) continue;
        const name = encodeURIComponent(decodeResourceNameFromUrl(child));
        if (child.endsWith("/")) {
            const childTarget = `${ensureTrailingSlash(target)}${name}/`;
            await createContainerAt(childTarget as UrlString, { fetch: fetchFn });
            folders.push(child);
            await copyTree(child, childTarget, fetchFn, files, folders);
        } else {
            files.push(await copyFile(child, `${ensureTrailingSlash(target)}${name}`, undefined, fetchFn));
        }
    }
}

/**
 * Deletes an original file only if it is still the version that was copied
 * (If-Match). Without an ETag that can't be checked, so the file is kept.
 * Returns why it was kept, or null once it is gone.
 */
async function removeUnchangedFile({ url, etag }: CopiedFile, fetchFn: typeof fetch): Promise<KeptBecause | null> {
    if (!etag) return "unverified";
    try {
        const response = await fetchFn(url, { method: "DELETE", headers: { "If-Match": etag } });
        if (response.ok || response.status === 404) return null;
        if (response.status === 412) return "changed";
    } catch (error) {
        console.warn(`Could not remove the original after renaming ${url}:`, error);
    }
    return "failed";
}

async function removeFolder(url: string, fetchFn: typeof fetch): Promise<KeptBecause | null> {
    try {
        const response = await fetchFn(url, { method: "DELETE" });
        if (response.ok || response.status === 404) return null;
    } catch (error) {
        console.warn(`Could not remove the original folder ${url}:`, error);
    }
    return "failed";
}
