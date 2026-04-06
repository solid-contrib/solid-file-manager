"use client";

import { useState, useRef } from "react";
import { getFileIcon, formatFileSize, formatDate, type FileType } from "../lib/helpers";
import FileItemMenu from "./FileItemMenu";
import type { AccessEntry, AccessResult } from "./FileList";

/**
 * Extracts a short readable label from a WebID URL.
 * e.g. "http://localhost:3000/alice/profile/card#me" → "alice"
 */
function extractShortLabel(agent: string): string {
  if (agent === "PUBLIC") return "Anyone";
  if (agent === "AUTHENTICATED") return "Authenticated";
  try {
    const url = new URL(agent);
    const segments = url.pathname.split("/").filter(Boolean);
    if (segments.length > 0) {
      return segments[0];
    }
    return url.hostname;
  } catch {
    const parts = agent.split(/[/#]/).filter(Boolean);
    return parts[parts.length - 1] || agent;
  }
}

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

  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

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

    const entries = accessResult.entries;

    if (entries.length === 0) {
      return (
        <span className="inline-flex items-center rounded px-1.5 py-0.5 text-xs bg-green-50 text-green-700 cursor-default"
          title="No access control rules found. Only the resource owner can access this.">
          Private
        </span>
      );
    }

    // Categorize entries
    const publicEntries = entries.filter(e => e.isPublic);
    const authenticatedEntries = entries.filter(e => e.isAuthenticated);
    const agentEntries = entries.filter(e => !e.isPublic && !e.isAuthenticated);

    const allInherited = entries.every(e => e.inherited);
    const someInherited = entries.some(e => e.inherited);

    // Build category chips
    type Category = { key: string; label: string; chipClass: string; entries: AccessEntry[]; title: string };
    const categories: Category[] = [];

    if (publicEntries.length > 0) {
      const modes = [...new Set(publicEntries.flatMap(e => e.modes))];
      categories.push({
        key: "public",
        label: `Public: ${modes.join(", ")}`,
        chipClass: "bg-orange-50 text-orange-800 hover:bg-orange-100 border border-orange-200",
        entries: publicEntries,
        title: `Accessible by anyone on the internet\nModes: ${modes.join(", ")}`,
      });
    }

    if (authenticatedEntries.length > 0) {
      const modes = [...new Set(authenticatedEntries.flatMap(e => e.modes))];
      categories.push({
        key: "authenticated",
        label: `Authenticated: ${modes.join(", ")}`,
        chipClass: "bg-blue-50 text-blue-800 hover:bg-blue-100 border border-blue-200",
        entries: authenticatedEntries,
        title: `Accessible by any logged-in user\nModes: ${modes.join(", ")}`,
      });
    }

    if (agentEntries.length > 0) {
      // Group: if there's only 1 agent, show it directly; otherwise show count
      if (agentEntries.length === 1) {
        const entry = agentEntries[0];
        const shortLabel = extractShortLabel(entry.agent);
        categories.push({
          key: "agents",
          label: `${shortLabel}: ${entry.modes.join(", ")}`,
          chipClass: "bg-purple-50 text-purple-800 hover:bg-purple-100 border border-purple-200",
          entries: agentEntries,
          title: `${entry.agent}\nModes: ${entry.modes.join(", ")}`,
        });
      } else {
        categories.push({
          key: "agents",
          label: `${agentEntries.length} users shared`,
          chipClass: "bg-purple-50 text-purple-800 hover:bg-purple-100 border border-purple-200",
          entries: agentEntries,
          title: agentEntries.map(e => `${e.agent}: ${e.modes.join(", ")}`).join("\n"),
        });
      }
    }

    return (
      <div className="flex flex-wrap items-center gap-1">
        {categories.map((cat) => {
          const isExpanded = expandedCategory === cat.key;

          return (
            <span key={cat.key} className="inline-flex items-center gap-1">
              <button
                type="button"
                className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs transition-colors cursor-pointer ${cat.chipClass}`}
                title={isExpanded ? undefined : cat.title}
                onClick={(e) => {
                  e.stopPropagation();
                  setExpandedCategory(isExpanded ? null : cat.key);
                }}
              >
                {isExpanded ? (
                  <span className="break-all text-left">
                    {cat.entries.map((entry, i) => (
                      <span key={entry.agent}>
                        {i > 0 && ", "}
                        {entry.isPublic ? "Anyone" : entry.isAuthenticated ? "Authenticated users" : entry.agent}
                        : {entry.modes.join(", ")}
                      </span>
                    ))}
                  </span>
                ) : (
                  <span>{cat.label}</span>
                )}
              </button>
            </span>
          );
        })}
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
      {accessResult !== undefined && (
        <div className="min-w-0 flex-1 hidden sm:block">
          {renderPermissions()}
        </div>
      )}
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

