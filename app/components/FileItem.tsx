"use client";

import { useState, useRef } from "react";
import { getFileIcon, formatFileSize, formatDate, type FileType } from "../lib/helpers";
import FileItemMenu from "./FileItemMenu";

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
  onRename?: (file: FileItemData) => void;
  onPreview?: (file: FileItemData) => void;
  onCopy?: (file: FileItemData) => void;
  onMove?: (file: FileItemData) => void;
  onDownload?: (file: FileItemData) => void;
  onDelete?: (file: FileItemData) => void;
  onShare?: (file: FileItemData) => void;
  isSelected?: boolean;
  onContextMenu?: (file: FileItemData, event: React.MouseEvent) => void;
}

export default function FileItem({
  file,
  view,
  onSelect,
  onDoubleClick,
  onRename,
  onPreview,
  onCopy,
  onMove,
  onDownload,
  onDelete,
  onShare,
  isSelected = false,
  onContextMenu,
}: FileItemProps) {
  const [isHovered, setIsHovered] = useState(false);
  const clickCountRef = useRef(0);
  const clickTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastTapRef = useRef(0);
  const touchHandledRef = useRef(false);

  const handleClick = (e: React.MouseEvent) => {
    // Prevent click handler from running if we just handled a touch event
    if (touchHandledRef.current) {
      touchHandledRef.current = false;
      return;
    }

    clickCountRef.current += 1;
    
    if (clickCountRef.current === 1) {
      clickTimeoutRef.current = setTimeout(() => {
        if (clickCountRef.current === 1) {
          onSelect(file);
        }
        clickCountRef.current = 0;
        clickTimeoutRef.current = null;
      }, 300);
    } else if (clickCountRef.current === 2) {
      if (clickTimeoutRef.current) {
        clearTimeout(clickTimeoutRef.current);
        clickTimeoutRef.current = null;
      }
      clickCountRef.current = 0;
      e.preventDefault();
      e.stopPropagation();
      onDoubleClick(file);
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchHandledRef.current = true;
    // Reset the flag after a delay to allow click events to be ignored
    setTimeout(() => {
      touchHandledRef.current = false;
    }, 400);
    
    const currentTime = new Date().getTime();
    const tapLength = currentTime - lastTapRef.current;
    
    if (tapLength < 300 && tapLength > 0) {
      // Double tap detected
      e.preventDefault();
      e.stopPropagation();
      if (clickTimeoutRef.current) {
        clearTimeout(clickTimeoutRef.current);
        clickTimeoutRef.current = null;
      }
      clickCountRef.current = 0;
      onDoubleClick(file);
    } else {
      // Single tap - wait to see if there's a second tap
      clickCountRef.current = 1;
      clickTimeoutRef.current = setTimeout(() => {
        if (clickCountRef.current === 1) {
          onSelect(file);
        }
        clickCountRef.current = 0;
        clickTimeoutRef.current = null;
      }, 300);
    }
    
    lastTapRef.current = currentTime;
  };

  if (view === "grid") {
    return (
      <section
        className={`group relative flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 p-2 transition-colors sm:p-4 ${isSelected
            ? "border-[#7B42F6] bg-[#F9F6FF]"
            : "border-transparent bg-white hover:border-gray-300 hover:bg-gray-50"
          }`}
        style={{ touchAction: 'manipulation' }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={handleClick}
        onTouchStart={handleTouchStart}
        role="button"
        tabIndex={0}
        aria-label={`${file.type === "folder" ? "Folder" : "File"}: ${file.name}`}
        onContextMenu={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onContextMenu?.(file, event);
        }}
      >
        {isHovered && (
          <FileItemMenu
            file={file}
            position="top-right"
            onRename={onRename}
            onPreview={onPreview}
            onDownload={onDownload}
            onCopy={onCopy}
            onMove={onMove}
            onDelete={onDelete}
            onShare={onShare}
          />
        )}
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
      style={{ touchAction: 'manipulation' }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleClick}
      onTouchStart={handleTouchStart}
      role="button"
      tabIndex={0}
      aria-label={`${file.type === "folder" ? "Folder" : "File"}: ${file.name}`}
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onContextMenu?.(file, event);
      }}
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
        <FileItemMenu
          file={file}
          position="right"
          onRename={onRename}
          onPreview={onPreview}
          onDownload={onDownload}
          onCopy={onCopy}
          onMove={onMove}
          onDelete={onDelete}
          onShare={onShare}
        />
      )}
    </section>
  );
}

