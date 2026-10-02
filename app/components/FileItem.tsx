"use client";

import { useState, useRef } from "react";
import { getFileIcon, formatFileSize, formatDate, type FileType } from "../lib/helpers";
import FileItemMenu from "./FileItemMenu";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
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

  const secondaryLabel =
    file.lastModified
      ? formatDate(file.lastModified)
      : file.type === "folder"
        ? "Folder"
        : file.size
          ? formatFileSize(file.size)
          : "File";

  if (view === "grid") {
    return (
      <Item
        variant={isSelected ? "muted" : "outline"}
        size="default"
        className="relative h-full cursor-pointer select-none flex-col items-center justify-center gap-3 py-5 text-center hover:bg-muted"
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
        {isHovered && (
          <ItemActions className="absolute top-1.5 right-1.5 z-10">
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
          </ItemActions>
        )}
        <ItemMedia className="mb-0 flex size-14 items-center justify-center rounded-2xl bg-muted sm:size-16">
          {getFileIcon(file.type, file.mimeType)}
        </ItemMedia>
        <ItemContent className="w-full min-w-0 items-center gap-0.5">
          <ItemTitle className="w-full justify-center truncate text-xs sm:text-sm">
            {file.name}
          </ItemTitle>
          <ItemDescription className="line-clamp-1 w-full text-center text-xs">
            {secondaryLabel}
          </ItemDescription>
        </ItemContent>
      </Item>
    );
  }

  // List view
  return (
    <Item
      variant={isSelected ? "muted" : "outline"}
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
      <ItemMedia className="flex size-9 items-center justify-center rounded-xl bg-muted sm:size-10">
        {getFileIcon(file.type, file.mimeType)}
      </ItemMedia>

      <ItemContent className="min-w-0 gap-0.5">
        <ItemTitle className="w-full truncate">{file.name}</ItemTitle>
        <ItemDescription className="line-clamp-1 text-xs">
          {secondaryLabel}
        </ItemDescription>
      </ItemContent>

      <ItemActions className="ml-auto hidden min-w-20 shrink-0 justify-end text-muted-foreground md:flex">
        <span className="text-xs sm:text-sm">
          {file.size ? formatFileSize(file.size) : file.type === "folder" ? "—" : ""}
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

