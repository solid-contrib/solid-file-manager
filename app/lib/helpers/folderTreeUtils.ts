import { ensureTrailingSlash } from "./copyUtils";


/**
 * Returns true when folderUrl is the storage root or a folder inside it.
 */
export function isFolderUnderStorage(
  folderUrl: string,
  storageRootUrl: string,
): boolean {
  const folder = ensureTrailingSlash(folderUrl);
  const storage = ensureTrailingSlash(storageRootUrl);
  return folder === storage || folder.startsWith(storage);
}

/**
 * Compares two folder URLs after normalizing trailing slashes.
 */
export function folderUrlsEqual(a: string, b: string): boolean {
  return ensureTrailingSlash(a) === ensureTrailingSlash(b);
}

/**
 * Folder container URLs that must be expanded so currentFolderUrl is visible in the tree.
 * Used when navigation comes from the main view or breadcrumb.
 */
export function getAncestorFolderUrls(
  currentFolderUrl: string,
  storageRootUrl: string,
): string[] {
  const current = ensureTrailingSlash(currentFolderUrl);
  const storage = ensureTrailingSlash(storageRootUrl);

  if (!current.startsWith(storage)) {
    return [];
  }

  if (current === storage) {
    return [];
  }

  const storageUrl = new URL(storage);
  const storagePath = storageUrl.pathname;
  const currentPath = new URL(current).pathname;

  const relative = currentPath
    .slice(storagePath.length)
    .replace(/^\/|\/$/g, "");

  if (!relative) {
    return [];
  }

  const segments = relative.split("/").filter(Boolean);
  const ancestors: string[] = [storage];

  for (let i = 0; i < segments.length - 1; i++) {
    const pathParts = segments.slice(0, i + 1);
    const path = `${storagePath}${pathParts.join("/")}/`;
    ancestors.push(`${storageUrl.origin}${path}`);
  }

  return ancestors;
}
