"use client";

import { useState, useRef } from "react";
import { getFileIcon, formatFileSize, formatDate, type FileType } from "../lib/helpers";
import FileItemMenu from "./FileItemMenu";
import type { AccessEntry, AccessResult } from "./FileList";

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
  accessResult?: AccessResult | null | "loading";
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
  accessResult,
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

  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);

  type Category = { key: string; label: string; dotColor: string; chipClass: string; entries: AccessEntry[]; };

  const buildCategories = (): { categories: Category[]; allInherited: boolean; someInherited: boolean } | null => {
    if (accessResult === undefined || accessResult === "loading" || accessResult === null) return null;
    const entries = accessResult.entries;
    if (entries.length === 0) return { categories: [], allInherited: false, someInherited: false };

    const publicEntries = entries.filter(e => e.isPublic);
    const authenticatedEntries = entries.filter(e => e.isAuthenticated);
    const agentEntries = entries.filter(e => !e.isPublic && !e.isAuthenticated);

    const categories: Category[] = [];

    if (publicEntries.length > 0) {
      const modes = [...new Set(publicEntries.flatMap(e => e.modes))];
      categories.push({
        key: "public",
        label: `Public: ${modes.join(", ")}`,
        dotColor: "bg-red-400",
        chipClass: "bg-red-50 text-red-800",
        entries: publicEntries,
      });
    }

    if (authenticatedEntries.length > 0) {
      const modes = [...new Set(authenticatedEntries.flatMap(e => e.modes))];
      categories.push({
        key: "authenticated",
        label: `Authenticated: ${modes.join(", ")}`,
        dotColor: "bg-orange-400",
        chipClass: "bg-orange-50 text-orange-800",
        entries: authenticatedEntries,
      });
    }

    if (agentEntries.length > 0) {
      const modes = [...new Set(agentEntries.flatMap(e => e.modes))];
      categories.push({
        key: "agents",
        label: `Shared: ${modes.join(", ")}`,
        dotColor: "bg-purple-400",
        chipClass: "bg-purple-50 text-purple-800",
        entries: agentEntries,
      });
    }

    return {
      categories,
      allInherited: entries.every(e => e.inherited),
      someInherited: entries.some(e => e.inherited),
    };
  };

  const renderPermissions = () => {
    if (accessResult === undefined) return null;
    if (accessResult === "loading") {
      return (
        <div className="flex items-center">
          <div className="h-3 w-3 animate-spin rounded-full border-2 border-solid border-[#7B42F6] border-r-transparent" />
        </div>
      );
    }
    if (accessResult === null) {
      return <span className="text-xs text-gray-400" title="Failed to fetch permissions">error</span>;
    }

    const result = buildCategories();
    if (!result) return null;
    const { categories, allInherited, someInherited } = result;

    if (categories.length === 0) {
      return (
        <span className="inline-flex items-center rounded px-1.5 py-0.5 text-xs bg-green-50 text-green-700 cursor-default"
          title="No access control rules found. Only the resource owner can access this.">
          Private
        </span>
      );
    }

    return (
      <div className="flex flex-wrap items-center gap-1">
        {categories.map((cat) => (
          <span
            key={cat.key}
            className="relative inline-flex items-center"
            onMouseEnter={() => setHoveredCategory(cat.key)}
            onMouseLeave={() => setHoveredCategory(null)}
          >
            <span
              className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs cursor-default ${cat.chipClass}`}
            >
              {cat.label}
            </span>
            {hoveredCategory === cat.key && (
              <div className="absolute left-0 top-full z-50 mt-1 w-max max-w-sm rounded border border-gray-200 bg-white px-2.5 py-1.5 shadow-lg text-xs text-gray-700">
                {cat.entries.map((entry) => (
                  <div key={entry.agent} className="break-all py-0.5">
                    <span className="text-gray-600 select-all">{entry.rawAgent || entry.agent}</span>
                    <span className="text-gray-400"> — {entry.modes.join(", ")}</span>
                  </div>
                ))}
              </div>
            )}
          </span>
        ))}
        {someInherited && (
          <span
            className="text-xs text-gray-400 cursor-default"
            title={`Permissions inherited from parent container${accessResult.sourceUrl ? `\nSource: ${accessResult.sourceUrl}` : ""}`}
          >
            {allInherited ? "(inherited)" : "(partly inherited)"}
          </span>
        )}
      </div>
    );
  };

  const renderPermissionDots = () => {
    if (accessResult === undefined) return null;
    if (accessResult === "loading") {
      return (
        <div className="absolute bottom-1 left-1 sm:bottom-2 sm:left-2">
          <div className="h-2.5 w-2.5 animate-spin rounded-full border-[1.5px] border-solid border-[#7B42F6] border-r-transparent" />
        </div>
      );
    }
    if (accessResult === null) return null;

    const result = buildCategories();
    if (!result) return null;
    const { categories } = result;

    if (categories.length === 0) {
      return (
        <div
          className="absolute bottom-1 left-1 sm:bottom-2 sm:left-2 flex items-center"
          onMouseEnter={() => setHoveredCategory("private")}
          onMouseLeave={() => setHoveredCategory(null)}
        >
          <span className="relative inline-block h-2.5 w-2.5 rounded-full bg-green-400 cursor-default" />
          {hoveredCategory === "private" && (
            <div className="absolute left-0 bottom-full z-50 mb-1 w-max max-w-xs rounded border border-gray-200 bg-white px-2 py-1 shadow-lg text-xs text-gray-700">
              Private — only the owner
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="absolute bottom-1 left-1 sm:bottom-2 sm:left-2 flex items-center gap-0.5">
        {categories.map((cat) => (
          <span
            key={cat.key}
            className="relative inline-flex items-center"
            onMouseEnter={() => setHoveredCategory(cat.key)}
            onMouseLeave={() => setHoveredCategory(null)}
          >
            <span className={`inline-block h-2.5 w-2.5 rounded-full cursor-default ${cat.dotColor}`} />
            {hoveredCategory === cat.key && (
              <div className="absolute left-0 bottom-full z-50 mb-1 w-max max-w-xs rounded border border-gray-200 bg-white px-2 py-1 shadow-lg text-xs text-gray-700">
                <div className="font-medium mb-0.5">{cat.label}</div>
                {cat.entries.map((entry) => (
                  <div key={entry.agent} className="break-all py-0.5">
                    <span className="text-gray-600 select-all">{entry.rawAgent || entry.agent}</span>
                    <span className="text-gray-400"> — {entry.modes.join(", ")}</span>
                  </div>
                ))}
              </div>
            )}
          </span>
        ))}
      </div>
    );
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
        {renderPermissionDots()}
      </section>
    );
  }

  // List view — always use grid layout for consistent alignment
  const hasPermissions = accessResult !== undefined;

  return (
    <section
      className={`group relative cursor-pointer border-b border-gray-100 px-2 py-2 transition-colors sm:px-4 sm:py-3 ${
        hasPermissions ? "hidden sm:grid" : "grid"
      } items-center ${isSelected ? "bg-[#F9F6FF]" : "bg-white hover:bg-gray-50"}`}
      style={{
        gridTemplateColumns: hasPermissions
          ? "40px minmax(0,2fr) minmax(0,3fr) 8rem 5rem"
          : "40px minmax(0,1fr) 8rem 5rem",
        touchAction: "manipulation",
      }}
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
      <div className="flex h-10 w-10 items-center justify-center">
        {getFileIcon(file.type, file.mimeType)}
      </div>
      <div className="min-w-0">
        <p className="truncate text-xs font-medium text-black sm:text-sm">{file.name}</p>
      </div>
      {hasPermissions && (
        <div className="min-w-0">
          {renderPermissions()}
        </div>
      )}
      <div className="hidden text-xs text-gray-600 sm:block sm:text-sm">
        {file.lastModified && formatDate(file.lastModified)}
      </div>
      <div className="hidden text-xs text-gray-600 md:block md:text-sm">
        {file.size && formatFileSize(file.size)}
      </div>
      {isHovered && (
        <div className="absolute right-2 top-1/2 -translate-y-1/2 z-10">
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
        </div>
      )}
    </section>
  );
}

