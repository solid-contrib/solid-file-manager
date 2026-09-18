// This helper file handles uploading files and folders to Solid containers.
import {
  createContainerAt,
  overwriteFile,
  UrlString,
} from "@inrupt/solid-client";
import {
  ensureTrailingSlash,
  getHttpStatus,
  sanitizeResourceName,
  fetchContainerListing,
} from ".";
import { getContainerListing, loadContainerListing } from "../cache";
import { toast } from "@/components/ui/toast";

export interface FolderUploadFile {
  file: File;
  relativePath: string;
}

export interface UploadResult {
  uploadedFiles: string[];
  failedFiles: string[];
}

export type UploadConflictChoice = "replace" | "keepBoth" | "cancel";

export interface UploadConflict {
  file: File;
  existingName: string;
  targetUrl: string;
}

export interface UploadConflictCheckResult {
  newFiles: File[];
  conflicts: UploadConflict[];
}

function buildFileTargetUrl(containerUrl: string, fileName: string): string {
  const parent = ensureTrailingSlash(containerUrl);
  return `${parent}${fileName}`;
}

async function getExistingChildNames(
  currentContainerUrl: string,
  fetchFn: typeof fetch,
): Promise<Set<string>> {
  const cached = getContainerListing(currentContainerUrl);
  const listing =
    cached ??
    (await loadContainerListing(currentContainerUrl, () =>
      fetchContainerListing(currentContainerUrl, fetchFn),
    ));

  return new Set(listing.map((item) => item.name));
}

export async function findUploadConflicts(
  files: File[],
  currentContainerUrl: string,
  fetchFn: typeof fetch,
): Promise<UploadConflictCheckResult> {
  const existingNames = await getExistingChildNames(
    currentContainerUrl,
    fetchFn,
  );

  const newFiles: File[] = [];
  const conflicts: UploadConflict[] = [];

  for (const file of files) {
    const existingName = sanitizeFilename(file.name);
    const targetUrl = buildFileTargetUrl(currentContainerUrl, existingName);

    if (existingNames.has(existingName)) {
      conflicts.push({ file, existingName, targetUrl });
    } else {
      newFiles.push(file);
    }
  }

  return { newFiles, conflicts };
}

/** Create-only PUT. Fails if the resource already exists (If-None-Match: *). */
async function putFile(
  fileUrl: string,
  file: File,
  fetchFn: typeof fetch,
): Promise<void> {
  const response = await fetchFn(fileUrl, {
    method: "PUT",
    headers: {
      "Content-Type": file.type || "application/octet-stream",
      "If-None-Match": "*",
    },
    body: file,
  });

  if (!response.ok) {
    const error = new Error(
      `Failed to create file at [${fileUrl}]: [${response.status}] [${response.statusText}]`,
    ) as Error & { status: number };
    error.status = response.status;
    throw error;
  }
}

function isNameConflictError(error: unknown): boolean {
  const status = getHttpStatus(error);
  return status === 412 || status === 409;
}

/** Try preferred name with putFile; on conflict, use Drive-style (1), (2), ... */
async function uploadFileCreateOnly(
  file: File,
  preferredName: string,
  currentContainerUrl: string,
  fetchFn: typeof fetch,
  usedNames: Set<string>,
): Promise<string> {
  const preferred = sanitizeFilename(preferredName);

  if (!usedNames.has(preferred)) {
    try {
      await putFile(
        buildFileTargetUrl(currentContainerUrl, preferred),
        file,
        fetchFn,
      );
      usedNames.add(preferred);
      return preferred;
    } catch (error) {
      if (!isNameConflictError(error)) {
        throw error;
      }
      usedNames.add(preferred);
    }
  }

  const lastDot = preferred.lastIndexOf(".");
  const base = lastDot > 0 ? preferred.slice(0, lastDot) : preferred;
  const ext = lastDot > 0 ? preferred.slice(lastDot) : "";

  let attempt = 1;
  while (true) {
    const displayName = `${base} (${attempt})${ext}`;
    const candidateName = sanitizeFilename(displayName);

    if (usedNames.has(candidateName)) {
      attempt += 1;
      continue;
    }

    try {
      await putFile(
        buildFileTargetUrl(currentContainerUrl, candidateName),
        file,
        fetchFn,
      );
      usedNames.add(candidateName);
      return displayName;
    } catch (error) {
      if (isNameConflictError(error)) {
        usedNames.add(candidateName);
        attempt += 1;
        continue;
      }
      throw error;
    }
  }
}

export async function uploadFileWithConflictChoice(
  conflict: UploadConflict,
  choice: Exclude<UploadConflictChoice, "cancel">,
  currentContainerUrl: string,
  fetchFn: typeof fetch,
): Promise<{ uploadedName: string }> {
  const { file, existingName, targetUrl } = conflict;

  if (choice === "replace") {
    await overwriteFile(targetUrl as UrlString, file, {
      contentType: file.type || "application/octet-stream",
      fetch: fetchFn,
    });
    return { uploadedName: existingName };
  }

  const usedNames = await getExistingChildNames(currentContainerUrl, fetchFn);
  const uploadedName = await uploadFileCreateOnly(
    file,
    existingName,
    currentContainerUrl,
    fetchFn,
    usedNames,
  );
  return { uploadedName };
}

export async function uploadFilesToContainer(
  files: File[],
  currentContainerUrl: string,
  fetchFn: typeof fetch,
): Promise<UploadResult> {
  const usedNames = await getExistingChildNames(currentContainerUrl, fetchFn);
  const uploadedFiles: string[] = [];
  const failedFiles: string[] = [];

  for (const file of files) {
    const preferredName = sanitizeFilename(file.name);
    try {
      const uploadedName = await uploadFileCreateOnly(
        file,
        preferredName,
        currentContainerUrl,
        fetchFn,
        usedNames,
      );
      uploadedFiles.push(uploadedName);
    } catch {
      failedFiles.push(preferredName);
    }
  }

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
          toast.add({ title: `Folder "${folderName}" already exists` });
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
