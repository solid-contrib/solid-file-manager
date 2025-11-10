"use client";

import { useState } from "react";
import Button from "./shared/Button";
import { EllipsisVerticalIcon } from "@heroicons/react/24/outline";
import { getFileIcon, formatFileSize, formatDate, type FileType } from "../lib/helpers";

export type { FileType };

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
      <section
        className={`group relative flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 p-2 transition-colors sm:p-4 ${isSelected
            ? "border-[#7B42F6] bg-[#F9F6FF]"
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
      </section>
    );
  }

  // List view
  return (
    <section
      className={`group flex cursor-pointer items-center gap-2 border-b border-gray-100 px-2 py-2 transition-colors sm:gap-4 sm:px-4 sm:py-3 ${isSelected ? "bg-[#F9F6FF]" : "bg-white hover:bg-gray-50"
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
          <Button
            variant="icon"
            aria-label="More options"
            onClick={(e) => {
              e.stopPropagation();
              // Handle more options
            }}
          >
            <EllipsisVerticalIcon className="h-4 w-4 sm:h-5 sm:w-5" />
          </Button>
        </div>
      )}
    </section>
  );
}

