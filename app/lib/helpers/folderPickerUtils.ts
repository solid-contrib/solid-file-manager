import {
  getSolidDataset,
  getContainedResourceUrlAll,
  isContainer,
  UrlString,
} from "@inrupt/solid-client";
import { ensureTrailingSlash } from "./copyUtils";
import { extractNameFromUrl } from "./urlUtils";
import { folder } from "jszip";

export type FolderPickerChild = {
  url: string;
  name: string;
};

/**
 * Lists direct child folders of a container. Files are omitted.
 */
export async function fetchFolderChildren(
  containerUrl: string,
  fetchFn: typeof fetch,
): Promise<FolderPickerChild[]> {
  const url = ensureTrailingSlash(containerUrl);
  const dataset = await getSolidDataset(url as UrlString, { fetch: fetchFn });
  const contained = getContainedResourceUrlAll(dataset);

  const folders: FolderPickerChild[] = [];

  for (const resourceUrl of contained) {
    if (resourceUrl.endsWith(".acl") || resourceUrl.endsWith(".meta")) {
      continue;
    }
    if (!isContainer(resourceUrl)) {
      continue;
    }

    const folderUrl = ensureTrailingSlash(resourceUrl);
    folders.push({
      url: folderUrl,
      name: extractNameFromUrl(folderUrl),
    });
  }

  folders.sort((a, b) => a.name.localeCompare(b.name));
  return folders;
}
