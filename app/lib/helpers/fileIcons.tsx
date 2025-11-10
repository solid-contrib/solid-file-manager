/**
 * File icon utility functions for rendering appropriate icons based on file type
 */

import {
  FolderIcon,
  PhotoIcon,
  DocumentIcon,
} from "@heroicons/react/24/outline";

export type FileType = "folder" | "file" | "image" | "document" | "other";

/**
 * Returns the appropriate icon component for a given file type
 * @param type - The type of file (folder, image, document, etc.)
 * @param mimeType - Optional MIME type for more specific icon selection
 * @returns React component for the file icon
 */
export function getFileIcon(type: FileType, mimeType?: string) {
  switch (type) {
    case "folder":
      return <FolderIcon className="h-6 w-6 text-yellow-500" />;
    case "image":
      return <PhotoIcon className="h-6 w-6 text-green-500" />;
    case "document":
      return <DocumentIcon className="h-6 w-6 text-blue-500" />;
    default:
      return <DocumentIcon className="h-6 w-6 text-gray-500" />;
  }
}

