"use client";

import { useState } from "react";

export type FileType = "folder" | "file" | "image" | "document" | "other";

export interface FileItemData {
  id: string;
  name: string;
  type: FileType;
  url: string;
  lastModified?: Date;
  size?: number;
  mimeType?: string;
}

interface FileItemProps {
  file: FileItemData;
  view: "grid" | "list";
  onSelect: (file: FileItemData) => void;
  onDoubleClick: (file: FileItemData) => void;
  isSelected?: boolean;
}

function getFileIcon(type: FileType, mimeType?: string) {
  switch (type) {
    case "folder":
      return (
        <svg
          className="h-6 w-6 text-yellow-500"
          fill="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path d="M10 4H4c-1.11 0-2 .89-2 2v12c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2h-8l-2-2z" />
        </svg>
      );
    case "image":
      return (
        <svg
          className="h-6 w-6 text-green-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      );
    case "document":
      return (
        <svg
          className="h-6 w-6 text-blue-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
      );
    default:
      return (
        <svg
          className="h-6 w-6 text-gray-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
      );
  }
}

function formatFileSize(bytes?: number): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function formatDate(date?: Date): string {
  if (!date) return "";
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;

  return date.toLocaleDateString();
}

export default function FileItem({
  file,
  view,
  onSelect,
  onDoubleClick,
  isSelected = false,
}: FileItemProps) {
  const [isHovered, setIsHovered] = useState(false);

  if (view === "grid") {
    return (
      <div
        className={`group relative flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 p-2 transition-colors sm:p-4 ${
          isSelected
            ? "border-purple-500 bg-purple-50"
            : "border-transparent bg-white hover:border-gray-300 hover:bg-gray-50"
        }`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={() => onSelect(file)}
        onDoubleClick={() => onDoubleClick(file)}
        role="button"
        tabIndex={0}
        aria-label={`${file.type === "folder" ? "Folder" : "File"}: ${file.name}`}
      >
        <div className="mb-1 flex h-12 w-12 items-center justify-center sm:mb-2 sm:h-16 sm:w-16">
          {getFileIcon(file.type, file.mimeType)}
        </div>
        <p className="max-w-full truncate text-center text-xs font-medium text-black sm:text-sm">
          {file.name}
        </p>
      </div>
    );
  }

  // List view
  return (
    <div
      className={`group flex cursor-pointer items-center gap-2 border-b border-gray-100 px-2 py-2 transition-colors sm:gap-4 sm:px-4 sm:py-3 ${
        isSelected ? "bg-purple-50" : "bg-white hover:bg-gray-50"
      }`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => onSelect(file)}
      onDoubleClick={() => onDoubleClick(file)}
      role="button"
      tabIndex={0}
      aria-label={`${file.type === "folder" ? "Folder" : "File"}: ${file.name}`}
    >
      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center sm:h-10 sm:w-10">
        {getFileIcon(file.type, file.mimeType)}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-black sm:text-sm">{file.name}</p>
      </div>
      <div className="hidden flex-shrink-0 text-xs text-gray-600 sm:block sm:text-sm">
        {file.lastModified && formatDate(file.lastModified)}
      </div>
      <div className="hidden flex-shrink-0 text-xs text-gray-600 md:block md:text-sm">
        {file.size && formatFileSize(file.size)}
      </div>
      {isHovered && (
        <div className="flex-shrink-0">
          <button
            type="button"
            className="cursor-pointer rounded-md p-1 text-gray-600 hover:bg-gray-200"
            aria-label="More options"
            onClick={(e) => {
              e.stopPropagation();
              // Handle more options
            }}
          >
            <svg
              className="h-4 w-4 sm:h-5 sm:w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
              />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}

