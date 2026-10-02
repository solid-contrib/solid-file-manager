"use client";

import { useState, useRef } from "react";
import { getFileIcon, formatFileSize, formatDate, type FileType } from "../lib/helpers";
import FileItemMenu from "./FileItemMenu";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";

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

  const handleTouchStart = () => {
    touchHandledRef.current = true;
    // Reset the flag after a delay to allow click events to be ignored
    setTimeout(() => {
      touchHandledRef.current = false;
    }, 400);

    const currentTime = new Date().getTime();
    const tapLength = currentTime - lastTapRef.current;

    if (tapLength < 300 && tapLength > 0) {
      // Double tap detected

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
        className={`group relative flex cursor-pointer select-none flex-col items-center justify-center rounded-lg border-2 p-2 transition-colors sm:p-4 ${isSelected
          ? "border-primary bg-accent"
          : "border-transparent bg-background hover:border-border hover:bg-muted"
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
        <p className="max-w-full truncate text-center text-xs font-medium text-foreground sm:text-sm">
          {file.name}
        </p>
      </section>
    );
  }

  // List view
  return (
    <Item
      variant={isSelected ? "muted" : "default"}
      size="sm"
      className="cursor-pointer select-none hover:bg-muted"
      style={{ touchAction: "manipulation" }}
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
      <ItemMedia variant="icon" className="size-8 sm:size-10">
        {getFileIcon(file.type, file.mimeType)}
      </ItemMedia>

      <ItemContent className="min-w-0">
        <ItemTitle className="w-full truncate">{file.name}</ItemTitle>
      </ItemContent>

      <ItemActions className="ml-auto hidden shrink-0 text-muted-foreground sm:flex">
        <span className="text-xs sm:text-sm">
          {file.lastModified ? formatDate(file.lastModified) : ""}
        </span>
      </ItemActions>

      <ItemActions className="hidden shrink-0 text-muted-foreground md:flex">
        <span className="text-xs sm:text-sm">
          {file.size ? formatFileSize(file.size) : ""}
        </span>
      </ItemActions>

      {isHovered && (
        <ItemActions className="shrink-0">
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
        </ItemActions>
      )}
    </Item>
  );
}

