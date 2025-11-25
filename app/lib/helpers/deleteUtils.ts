import {
  deleteFile,
  getSolidDataset,
  getContainedResourceUrlAll,
  isContainer,
  UrlString,
} from "@inrupt/solid-client";
import { ensureTrailingSlash } from "./copyUtils";


/**
 * Recursively deletes all contents of a folder, then deletes the folder itself
 */
async function deleteFolderContents(
  folderUrl: string,
  fetchFn: typeof fetch,
  visited: Set<string> = new Set()
): Promise<void> {
  const normalizedUrl = ensureTrailingSlash(folderUrl);
  
  // Prevent infinite loops
  if (visited.has(normalizedUrl)) {
    return;
  }
  visited.add(normalizedUrl);

  try {
    const dataset = await getSolidDataset(normalizedUrl as UrlString, { fetch: fetchFn });
    const containedResources = getContainedResourceUrlAll(dataset);

    // Delete all contained resources
    for (const resourceUrl of containedResources) {
      try {
        // Skip .acl files (access control) and .meta files
        if (resourceUrl.endsWith(".acl") || resourceUrl.endsWith(".meta")) {
          continue;
        }
        
        if (isContainer(resourceUrl)) {
          // It's a folder - recursively delete its contents first, then the folder
          await deleteFolderContents(resourceUrl, fetchFn, visited);
          // Delete the folder itself
          await deleteFile(resourceUrl as UrlString, { fetch: fetchFn });
        } else {
          // It's a file - delete the file
          await deleteFile(resourceUrl as UrlString, { fetch: fetchFn });
        }
      } catch (error) {
        console.warn(`Failed to delete resource ${resourceUrl}:`, error);
      }
    }
  } catch (error) {
    console.error(`Failed to access folder ${folderUrl}:`, error);
    throw error;
  }
}

/**
 * Deletes a file resource
 */
export async function deleteFileResource(
  fileUrl: string,
  fetchFn: typeof fetch
): Promise<void> {
  try {
    // Delete the file
    await deleteFile(fileUrl as UrlString, { fetch: fetchFn });
  } catch (error) {
    console.error("Failed to delete file:", error);
    throw new Error(
      `Failed to delete file: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Deletes a folder resource and all its contents recursively
 */
export async function deleteFolderResource(
  folderUrl: string,
  fetchFn: typeof fetch
): Promise<void> {
  try {
    const normalizedUrl = ensureTrailingSlash(folderUrl);
    
    // First, delete all contents recursively
    await deleteFolderContents(normalizedUrl, fetchFn, new Set());
    
    // Delete the folder itself
    await deleteFile(normalizedUrl as UrlString, { fetch: fetchFn });
  } catch (error) {
    console.error("Failed to delete folder:", error);
    throw new Error(
      `Failed to delete folder: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

