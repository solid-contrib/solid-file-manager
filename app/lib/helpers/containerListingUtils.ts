import { getSolidDataset, toRdfJsDataset } from "@inrupt/solid-client";
import { DataFactory } from "n3";
import { FileItemData } from "../../components/FileItem";
import { ContainerDataset } from "../class/ContainerDataset";
import { ensureTrailingSlash } from "./copyUtils";
import type { FolderTreeChild } from "./folderTreeUtils";

/** Fetch and map a container's contained resources to FileItemData[]. */
export async function fetchContainerListing(
  url: string,
  fetchFn: typeof fetch,
): Promise<FileItemData[]> {
  const container = new ContainerDataset(
    toRdfJsDataset(await getSolidDataset(url, { fetch: fetchFn })),
    DataFactory,
  ).container;

  // Empty containers have no ldp:contains, so there is no container subject to match.
  // Treat that as an empty listing (not an error).
  if (container === undefined) {
    return [];
  }

  const fileItems: FileItemData[] = [];

  for (const item of container.contains) {
    try {
      let mimeType = item.mimeType;

      if (!item.isContainer && !mimeType) {
        try {
          const headResponse = await fetchFn(item.id, {
            method: "HEAD",
            headers: { Accept: "*/*" },
          });

          if (headResponse.ok) {
            const contentType = headResponse.headers.get("Content-Type");
            if (contentType) {
              mimeType = contentType.split(";")[0].trim();
            }
          }
        } catch (err) {
          console.debug(`Could not fetch content-type for ${item}:`, err);
        }
      }

      fileItems.push({
        id: item.id,
        name: item.name,
        type: item.fileType,
        url: item.id,
        lastModified: item.lastModified,
        size: item.size,
        mimeType,
      });
    } catch (err) {
      console.error(`Failed to process item ${item}:`, err);
    }
  }

  fileItems.sort((a, b) => {
    if (a.type === "folder" && b.type !== "folder") return -1;
    if (a.type !== "folder" && b.type === "folder") return 1;
    return a.name.localeCompare(b.name);
  });

  return fileItems;
}

/** Folders-only view of a cached/full listing (for the sidebar tree). */
export function foldersFromListing(items: FileItemData[]): FolderTreeChild[] {
  return items
    .filter((item) => item.type === "folder")
    .map((item) => ({
      url: ensureTrailingSlash(item.url),
      name: item.name,
    }));
}
