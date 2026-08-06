// Helper utilities for handling drag-and-drop file and folder uploads
import { FolderUploadFile } from "./uploadUtils";

// Type definitions for File System Access API
/**
 * The File System Access API's addition to DataTransferItem, which lib.dom does
 * not declare yet. It is what makes a dropped folder readable.
 */
type FileSystemAccessItem = DataTransferItem & {
  getAsFileSystemHandle?: () => Promise<FileSystemHandle | null>;
};

interface FileSystemHandle {
  readonly kind: "file" | "directory";
  readonly name: string;
}

interface FileSystemFileHandle extends FileSystemHandle {
  readonly kind: "file";
  getFile(): Promise<File>;
}

interface FileSystemDirectoryHandle extends FileSystemHandle {
  readonly kind: "directory";
  values(): AsyncIterableIterator<FileSystemHandle>;
}

// Helper function to recursively read directory contents using File System Access API
async function readDirectoryRecursive(
  directoryHandle: FileSystemDirectoryHandle,
  basePath: string
): Promise<FolderUploadFile[]> {
  const files: FolderUploadFile[] = [];

  try {
    for await (const entry of directoryHandle.values()) {
      if (entry.kind === "file") {
        const fileHandle = entry as FileSystemFileHandle;
        const file = await fileHandle.getFile();
        const relativePath = `${basePath}/${entry.name}`;
        files.push({ file, relativePath });
      } else if (entry.kind === "directory") {
        // Recursively read subdirectories
        const subFiles = await readDirectoryRecursive(
          entry as FileSystemDirectoryHandle,
          `${basePath}/${entry.name}`
        );
        files.push(...subFiles);
      }
    }
  } catch (error) {
    console.error(`Error reading directory ${basePath}:`, error);
  }

  return files;
}

export interface ProcessedDragDropFiles {
  singleFiles: File[];
  folderFiles: FolderUploadFile[];
}

/**
 * Processes drag-and-drop items, handling both files and folders
 * Uses File System Access API when available for folder support
 */
export async function processDragDropItems(
  event: React.DragEvent<HTMLElement>
): Promise<ProcessedDragDropFiles> {
  const singleFiles: File[] = [];
  const folderFiles: FolderUploadFile[] = [];

  // Use File System Access API for folder drag-and-drop
  const items = Array.from(event.dataTransfer.items);
  let hasDirectories = false;

  for (const item of items) {
    const handleSource = item as FileSystemAccessItem;
    if (handleSource.getAsFileSystemHandle) {
      try {
        const handle = await handleSource.getAsFileSystemHandle();
        if (handle && handle.kind === "directory") {
          hasDirectories = true;
          // Recursively read directory contents
          const directoryFiles = await readDirectoryRecursive(
            handle as FileSystemDirectoryHandle,
            handle.name
          );
          folderFiles.push(...directoryFiles);
        } else if (handle && handle.kind === "file") {
          const file = await (handle as FileSystemFileHandle).getFile();
          singleFiles.push(file);
        }
      } catch (error) {
        // File System Access API not supported or failed, fall back to regular files
        console.warn("File System Access API not available:", error);
      }
    }
  }

  // If File System Access API wasn't used, fall back to regular file handling
  if (!hasDirectories && items.length > 0) {
    const dataTransferFiles = event.dataTransfer.files;
    if (dataTransferFiles && dataTransferFiles.length > 0) {
      const allRelativePaths = new Set<string>();
      const folderNames = new Set<string>();

      // First pass: collect all relative paths and identify folder names
      Array.from(dataTransferFiles).forEach((file) => {
        const relativePath = file.webkitRelativePath || "";
        if (relativePath) {
          allRelativePaths.add(relativePath);
          // If path contains "/", extract the folder name (first part)
          if (relativePath.includes("/")) {
            const pathParts = relativePath.split("/").filter(Boolean);
            if (pathParts.length > 0) {
              folderNames.add(pathParts[0]);
            }
          }
        }
      });

      // Second pass: categorize files
      Array.from(dataTransferFiles).forEach((file) => {
        const relativePath = file.webkitRelativePath || "";
        if (relativePath && relativePath.includes("/")) {
          // File inside a folder
          folderFiles.push({ file, relativePath });
        } else if (relativePath) {
          const isFolderEntry = Array.from(allRelativePaths).some(
            (path: string) => path !== relativePath && path.startsWith(relativePath + "/")
          );
          // Also check if this matches a folder name we extracted
          const matchesFolderName = folderNames.has(relativePath);
          
          if (isFolderEntry || matchesFolderName) {
            // This is the folder itself, skip it
            return;
          }
          singleFiles.push(file);
        } else {
          if (folderNames.has(file.name)) {
            // This is likely the folder itself, skip it
            return;
          }
          singleFiles.push(file);
        }
      });
    }
  }

  return { singleFiles, folderFiles };
}

/**
 * Checks if a drag event contains files
 */
export function hasFiles(event: React.DragEvent<HTMLElement>): boolean {
  const types = event.dataTransfer?.types;
  return types && Array.from(types).includes("Files");
}

/**
 * Checks if a drag event is a folder drag (not supported without File System Access API)
 */
export function isUnsupportedFolderDrag(event: React.DragEvent<HTMLElement>): boolean {
  const dataTransferFiles = event.dataTransfer.files;
  if (!dataTransferFiles || dataTransferFiles.length === 0) {
    return false;
  }

  const allRelativePaths = new Set<string>();
  
  Array.from(dataTransferFiles).forEach((file) => {
    const relativePath = file.webkitRelativePath || "";
    if (relativePath) {
      allRelativePaths.add(relativePath);
    }
  });

  // Check if this is a folder drag (single entry with no webkitRelativePath and no files with paths)
  return (
    dataTransferFiles.length === 1 &&
    allRelativePaths.size === 0 &&
    !dataTransferFiles[0].webkitRelativePath
  );
}

