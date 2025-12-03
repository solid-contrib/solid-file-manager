/**
 * File icon utility functions for rendering appropriate icons based on file type
 */

import {
  FolderIcon,
  PhotoIcon,
  DocumentIcon,
  DocumentTextIcon,
  CodeBracketIcon,
  VideoCameraIcon,
  MusicalNoteIcon,
  PresentationChartBarIcon,
  TableCellsIcon,
  ArchiveBoxIcon,
} from "@heroicons/react/24/outline";

export type FileType = "folder" | "file" | "image" | "document" | "other";

/**
 * Determines the icon based on MIME type
 * @param mimeType - The MIME type of the file
 * @returns React component for the file icon with appropriate color
 */
function getIconFromMimeType(mimeType: string) {
  const normalizedMime = mimeType.toLowerCase().split(";")[0].trim();

  // Images
  if (normalizedMime.startsWith("image/")) {
    return <PhotoIcon className="h-6 w-6 text-green-500" />;
  }

  // PDFs
  if (normalizedMime === "application/pdf") {
    return <DocumentTextIcon className="h-6 w-6 text-blue-500" />;
  }

  // Videos
  if (normalizedMime.startsWith("video/")) {
    return <VideoCameraIcon className="h-6 w-6 text-purple-500" />;
  }

  // Audio
  if (normalizedMime.startsWith("audio/")) {
    return <MusicalNoteIcon className="h-6 w-6 text-pink-500" />;
  }

  // Code files
  if (
    normalizedMime.startsWith("text/") ||
    normalizedMime === "application/json" ||
    normalizedMime === "application/xml" ||
    normalizedMime === "text/xml" ||
    normalizedMime === "application/javascript" ||
    normalizedMime === "application/x-javascript" ||
    normalizedMime === "text/javascript" ||
    normalizedMime === "application/x-sh" ||
    normalizedMime === "application/x-yaml" ||
    normalizedMime === "text/yaml" ||
    normalizedMime === "text/css" ||
    normalizedMime === "text/html" ||
    normalizedMime === "text/markdown" ||
    normalizedMime === "text/plain"
  ) {
    return <CodeBracketIcon className="h-6 w-6 text-orange-500" />;
  }

  // Office documents - Word
  if (
    normalizedMime === "application/msword" ||
    normalizedMime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    normalizedMime === "application/vnd.ms-word.document.macroEnabled.12"
  ) {
    return <DocumentIcon className="h-6 w-6 text-blue-600" />;
  }

  // Office documents - Excel
  if (
    normalizedMime === "application/vnd.ms-excel" ||
    normalizedMime === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  ) {
    return <TableCellsIcon className="h-6 w-6 text-green-600" />;
  }

  // Office documents - PowerPoint
  if (
    normalizedMime === "application/vnd.ms-powerpoint" ||
    normalizedMime === "application/vnd.openxmlformats-officedocument.presentationml.presentation"
  ) {
    return <PresentationChartBarIcon className="h-6 w-6 text-orange-600" />;
  }

  // Archives
  if (
    normalizedMime === "application/zip" ||
    normalizedMime === "application/x-zip-compressed" ||
    normalizedMime === "application/x-rar-compressed" ||
    normalizedMime === "application/x-tar" ||
    normalizedMime === "application/gzip" ||
    normalizedMime === "application/x-7z-compressed"
  ) {
    return <ArchiveBoxIcon className="h-6 w-6 text-amber-600" />;
  }

  // CSV files
  if (normalizedMime === "text/csv" || normalizedMime === "application/x-csv") {
    return <TableCellsIcon className="h-6 w-6 text-green-500" />;
  }

  // Default document icon for other types
  return <DocumentIcon className="h-6 w-6 text-blue-500" />;
}

/**
 * Returns the appropriate icon component for a given file type
 * @param type - The type of file (folder, image, document, etc.)
 * @param mimeType - Optional MIME type for more specific icon selection (takes priority)
 * @returns React component for the file icon
 */
export function getFileIcon(type: FileType, mimeType?: string) {
  // Always show folder icon for folders
  if (type === "folder") {
    return <FolderIcon className="h-6 w-6 text-yellow-500" />;
  }

  // If MIME type is provided, use it for more specific icon selection
  if (mimeType) {
    return getIconFromMimeType(mimeType);
  }

  // Fallback to type-based icons if no MIME type
  switch (type) {
    case "image":
      return <PhotoIcon className="h-6 w-6 text-green-500" />;
    case "document":
      return <DocumentIcon className="h-6 w-6 text-blue-500" />;
    default:
      return <DocumentIcon className="h-6 w-6 text-gray-500" />;
  }
}

