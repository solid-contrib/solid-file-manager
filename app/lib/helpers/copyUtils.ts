import {
  getFile,
  overwriteFile,
  createContainerAt,
  getSolidDataset,
  getContainedResourceUrlAll,
  UrlString,
} from "@inrupt/solid-client";
import { getDisplayNameFromMeta, updateMetaFile } from "./metaFileUtils";

const INVALID_NAME_CHARS = /[<>:"/\\|?*]/g;

export const sanitizeResourceName = (name: string): string => {
  const sanitized = name.replace(INVALID_NAME_CHARS, "").trim();
  return sanitized || "Untitled";
};

export const decodeResourceNameFromUrl = (resourceUrl: string): string => {
  try {
    const urlObj = new URL(resourceUrl);
    const segments = urlObj.pathname.split("/").filter(Boolean);
    if (segments.length === 0) {
      return urlObj.hostname;
    }
    const lastSegment = resourceUrl.endsWith("/") ? segments[segments.length - 1] : segments[segments.length - 1];
    return decodeURIComponent(lastSegment);
  } catch {
    return resourceUrl;
  }
};

export const ensureTrailingSlash = (url: string): string => (url.endsWith("/") ? url : `${url}/`);

export const getParentContainerUrl = (resourceUrl: string): string => {
  try {
    const urlObj = new URL(resourceUrl);
    const segments = urlObj.pathname.split("/").filter(Boolean);
    if (segments.length === 0) {
      return `${urlObj.origin}/`;
    }
    if (!resourceUrl.endsWith("/")) {
      segments.pop();
    } else if (segments.length > 0) {
      segments.pop();
    }
    const parentPath = segments.length ? `/${segments.join("/")}/` : "/";
    return `${urlObj.origin}${parentPath}`;
  } catch {
    return resourceUrl;
  }
};

const shouldSkipResourceCopy = (resourceUrl: string): boolean => {
  return resourceUrl.endsWith(".meta") || resourceUrl.endsWith(".acl");
};

const resourceExists = async (url: string, fetchFn: typeof fetch): Promise<boolean> => {
  try {
    const response = await fetchFn(url, { method: "HEAD" });
    if (response.status === 404) {
      return false;
    }
    if (response.status >= 200 && response.status < 300) {
      return true;
    }
    // For other statuses (401, 403, 405, etc.) assume the resource exists to avoid collisions
    return true;
  } catch {
    return false;
  }
};

export const generateCopyTarget = async (
  parentUrl: string,
  desiredName: string,
  isContainer: boolean,
  fetchFn: typeof fetch
): Promise<{ targetUrl: string; displayName: string }> => {
  const parentWithSlash = ensureTrailingSlash(parentUrl);
  let attempt = 0;

  while (attempt < 100) {
    const candidateDisplayName = attempt === 0 ? desiredName : `${desiredName} (${attempt})`;
    const candidatePathName = sanitizeResourceName(candidateDisplayName);
    const encodedName = encodeURIComponent(candidatePathName);
    const candidateUrl = isContainer ? `${parentWithSlash}${encodedName}/` : `${parentWithSlash}${encodedName}`;
    const exists = await resourceExists(candidateUrl, fetchFn);
    if (!exists) {
      return { targetUrl: candidateUrl, displayName: candidateDisplayName };
    }
    attempt += 1;
  }

  throw new Error("Unable to generate a unique name for the copy");
};

const copyFileFromSource = async (
  sourceUrl: string,
  targetUrl: string,
  displayName: string,
  fetchFn: typeof fetch,
  mimeTypeHint?: string
): Promise<void> => {
  const fileBlob = await getFile(sourceUrl as UrlString, { fetch: fetchFn });
  const contentType = fileBlob.type || mimeTypeHint || "application/octet-stream";
  await overwriteFile(targetUrl as UrlString, fileBlob, {
    fetch: fetchFn,
    contentType,
  });
  await updateMetaFile(targetUrl as UrlString, displayName, fetchFn);
};

const copyFolderContents = async (
  sourceFolderUrl: string,
  destinationFolderUrl: string,
  fetchFn: typeof fetch
): Promise<void> => {
  const dataset = await getSolidDataset(sourceFolderUrl, { fetch: fetchFn });
  const containedResources = getContainedResourceUrlAll(dataset);

  for (const resourceUrl of containedResources) {
    if (shouldSkipResourceCopy(resourceUrl)) {
      continue;
    }

    if (resourceUrl.endsWith("/")) {
      const childName = decodeResourceNameFromUrl(resourceUrl);
      const encodedChildName = encodeURIComponent(childName);
      const childDestination = `${ensureTrailingSlash(destinationFolderUrl)}${encodedChildName}/`;

      await createContainerAt(childDestination as UrlString, { fetch: fetchFn });
      const childDisplayName =
        (await getDisplayNameFromMeta(resourceUrl, fetchFn)) ?? childName;
      await updateMetaFile(childDestination as UrlString, childDisplayName, fetchFn);

      await copyFolderContents(resourceUrl, childDestination, fetchFn);
    } else {
      const childName = decodeResourceNameFromUrl(resourceUrl);
      const encodedChildName = encodeURIComponent(childName);
      const childDestination = `${ensureTrailingSlash(destinationFolderUrl)}${encodedChildName}`;
      const childDisplayName =
        (await getDisplayNameFromMeta(resourceUrl, fetchFn)) ?? childName;
      await copyFileFromSource(resourceUrl, childDestination, childDisplayName, fetchFn);
    }
  }
};

export const copyFileResource = async (
  file: { url: string; name?: string; mimeType?: string },
  fetchFn: typeof fetch
): Promise<void> => {
  const originalLabel =
    (await getDisplayNameFromMeta(file.url, fetchFn)) ??
    file.name ??
    decodeResourceNameFromUrl(file.url);
  const parentUrl = getParentContainerUrl(file.url);
  const desiredName = `Copy of ${originalLabel}`;
  const { targetUrl, displayName } = await generateCopyTarget(parentUrl, desiredName, false, fetchFn);
  await copyFileFromSource(file.url, targetUrl, displayName, fetchFn, file.mimeType);
};

export const copyFolderResource = async (
  folder: { url: string; name?: string },
  fetchFn: typeof fetch
): Promise<void> => {
  const originalLabel =
    (await getDisplayNameFromMeta(folder.url, fetchFn)) ??
    folder.name ??
    decodeResourceNameFromUrl(folder.url);
  const parentUrl = getParentContainerUrl(folder.url);
  const desiredName = `Copy of ${originalLabel}`;
  const { targetUrl, displayName } = await generateCopyTarget(parentUrl, desiredName, true, fetchFn);

  await createContainerAt(targetUrl as UrlString, { fetch: fetchFn });
  await updateMetaFile(targetUrl as UrlString, displayName, fetchFn);
  await copyFolderContents(folder.url, targetUrl, fetchFn);
};

