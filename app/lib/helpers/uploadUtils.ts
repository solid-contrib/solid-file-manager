// This helper file handles uploading files and folders to Solid containers.
import {
  createContainerAt,
  overwriteFile,
  UrlString,
} from "@inrupt/solid-client";
import { ensureTrailingSlash, getHttpStatus, sanitizeResourceName } from ".";
import toast from "react-hot-toast";

export interface FolderUploadFile {
  file: File;
  relativePath: string;
}

export interface UploadResult {
  uploadedFiles: string[];
  failedFiles: string[];
}

export async function uploadFilesToContainer(
  files: File[],
  currentContainerUrl: string,
  fetchFn: typeof fetch,
): Promise<UploadResult> {
  const uploadPromises: Promise<void>[] = [];
  const uploadedFiles: string[] = [];
  const failedFiles: string[] = [];

  for (const file of files) {
    const sanitizedName = sanitizeFilename(file.name);
    const fileUrl = currentContainerUrl.endsWith("/")
      ? `${currentContainerUrl}${sanitizedName}`
      : `${currentContainerUrl}/${sanitizedName}`;

    const uploadPromise = overwriteFile(fileUrl as UrlString, file, {
      contentType: file.type || "application/octet-stream",
      fetch: fetchFn,
    })
      .then(() => {
        uploadedFiles.push(sanitizedName);
      })
      .catch(() => {
        failedFiles.push(sanitizedName);
      });

    uploadPromises.push(uploadPromise);
  }

  await Promise.all(uploadPromises);

  return { uploadedFiles, failedFiles };
}

export async function uploadFolderFilesToContainer(
  folderFiles: FolderUploadFile[],
  currentContainerUrl: string,
  fetchFn: typeof fetch,
): Promise<UploadResult> {
  const uploadedFiles: string[] = [];
  const failedFiles: string[] = [];
  const createdFolders = new Set<string>();
  const uploadPromises: Promise<void>[] = [];

  for (const { file, relativePath } of folderFiles) {
    // Skip if relativePath ends with "/" - this indicates it's a folder entry, not a file
    if (relativePath.endsWith("/")) {
      continue;
    }

    const pathParts = relativePath.split("/").filter(Boolean);
    if (pathParts.length === 0) {
      continue;
    }

    if (pathParts.length === 1) {
      // This is likely the folder itself, not a file inside it - skip it
      continue;
    }

    const folderName = sanitizeFilename(pathParts[0]);
    const innerPath = pathParts.slice(1);

    const baseFolderUrl = ensureTrailingSlash(
      currentContainerUrl.endsWith("/")
        ? `${currentContainerUrl}${encodeURIComponent(folderName)}`
        : `${currentContainerUrl}/${encodeURIComponent(folderName)}`,
    );

    await ensureFolderExists(baseFolderUrl, fetchFn, createdFolders);

    let currentPath = baseFolderUrl;

    for (let i = 0; i < innerPath.length - 1; i++) {
      const segment = sanitizeFilename(innerPath[i]);
      const encodedSegment = encodeURIComponent(segment);
      currentPath = ensureTrailingSlash(`${currentPath}${encodedSegment}`);
      await ensureFolderExists(currentPath, fetchFn, createdFolders);
    }

    const fileName = sanitizeFilename(innerPath[innerPath.length - 1]);
    const fileUrl = `${currentPath}${encodeURIComponent(fileName)}`;

    const uploadPromise = overwriteFile(fileUrl as UrlString, file, {
      contentType: file.type || "application/octet-stream",
      fetch: fetchFn,
    })
      .then(() => {
        uploadedFiles.push(relativePath);
      })
      .catch(() => {
        failedFiles.push(relativePath);
      });

    uploadPromises.push(uploadPromise);
  }

  await Promise.all(uploadPromises);
  return { uploadedFiles, failedFiles };
}

async function ensureFolderExists(
  folderUrl: string,
  fetchFn: typeof fetch,
  createdFolders: Set<string>,
): Promise<void> {
  if (createdFolders.has(folderUrl)) {
    return;
  }

  try {
    await createContainerAt(folderUrl as UrlString, { fetch: fetchFn });
  } catch (error: unknown) {
    const statusCode = getHttpStatus(error);
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (
      statusCode === 409 ||
      errorMessage.includes("409") ||
      errorMessage.includes("Conflict") ||
      errorMessage.includes("already exists")
    ) {
      // Folder already exists - show toast once
      if (!createdFolders.has(folderUrl + "_notified")) {
        try {
          const urlObj = new URL(folderUrl);
          const pathSegments = urlObj.pathname.split("/").filter(Boolean);
          const folderName =
            pathSegments.length > 0
              ? decodeURIComponent(pathSegments[pathSegments.length - 1])
              : folderUrl;
          toast(`Folder "${folderName}" already exists`);
        } catch {
          // Skip toast if URL parsing fails
        }
        createdFolders.add(folderUrl + "_notified");
      }
      return;
    }

    console.warn(`Failed to create folder ${folderUrl}:`, {
      statusCode,
      error: errorMessage,
    });
  } finally {
    createdFolders.add(folderUrl);
  }
}

function sanitizeFilename(name: string): string {
  const sanitized = sanitizeResourceName(name);
  return sanitized || "Untitled";
}
