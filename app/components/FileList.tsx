"use client";

import { useState, useEffect, useRef } from "react";
import FileItem, { FileItemData } from "./FileItem";
import Toolbar from "./shared/Toolbar";
import EmptyState from "./shared/EmptyState";
import { getResourceAccessList, type AccessEntry, type AccessResult } from "../lib/helpers/acpUtils";

export type { AccessEntry, AccessResult };
type PermissionsMap = Record<string, AccessResult | null | "loading">;

interface FileListProps {
  files: FileItemData[];
  currentPath: string;
  onFileSelect: (file: FileItemData) => void;
  onFileDoubleClick: (file: FileItemData) => void;
  onFileRename?: (file: FileItemData) => void;
  onFilePreview?: (file: FileItemData) => void;
  onFileCopy?: (file: FileItemData) => void;
  onFileMove?: (file: FileItemData) => void;
  onFileDownload?: (file: FileItemData) => void;
  onFileDelete?: (file: FileItemData) => void;
  onFileShare?: (file: FileItemData) => void;
  selectedFileIds: string[];
  onFileContextMenu?: (file: FileItemData, event: React.MouseEvent) => void;
  showPermissions?: boolean;
  onTogglePermissions?: () => void;
}

const VIEW_STORAGE_KEY = "solid-file-manager-view";

export default function FileList({
  files,
  currentPath,
  onFileSelect,
  onFileDoubleClick,
  onFileRename,
  onFilePreview,
  onFileCopy,
  onFileMove,
  onFileDownload,
  onFileDelete,
  onFileShare,
  selectedFileIds,
  onFileContextMenu,
  showPermissions,
  onTogglePermissions,
}: FileListProps) {
  const [view, setView] = useState<"grid" | "list">(() => {
    if (typeof window === "undefined") return "list";
    const stored = localStorage.getItem(VIEW_STORAGE_KEY);
    return (stored === "grid" || stored === "list") ? stored : "list";
  });

  const [permissionsState, setPermissionsState] = useState<{ path: string; map: PermissionsMap }>({ path: currentPath, map: {} });
  const fetchedUrlsRef = useRef<Set<string>>(new Set());

  // Derive the current map, resetting if path changed
  const permissionsMap = permissionsState.path === currentPath ? permissionsState.map : {};

  // Fetch permissions for all visible files when toggle is on
  useEffect(() => {
    fetchedUrlsRef.current = new Set();

    if (!showPermissions || files.length === 0) return;

    let cancelled = false;

    const fetchAll = async () => {
      const toFetch = files.filter(f => !fetchedUrlsRef.current.has(f.url));
      if (toFetch.length === 0) return;

      // Mark all as loading
      const loadingMap: PermissionsMap = {};
      for (const f of toFetch) {
        loadingMap[f.url] = "loading";
        fetchedUrlsRef.current.add(f.url);
      }
      if (!cancelled) setPermissionsState({ path: currentPath, map: loadingMap });

      // Fetch in parallel
      await Promise.all(
        toFetch.map(async (file) => {
          try {
            const resourceUrl = file.type === "folder" && !file.url.endsWith("/")
              ? file.url + "/"
              : file.url;
            const list = await getResourceAccessList(resourceUrl);
            if (!cancelled) setPermissionsState(prev => ({ ...prev, map: { ...prev.map, [file.url]: list } }));
          } catch {
            if (!cancelled) setPermissionsState(prev => ({ ...prev, map: { ...prev.map, [file.url]: null } }));
          }
        })
      );
    };

    fetchAll();

    return () => { cancelled = true; };
  }, [showPermissions, currentPath, files]);

  useEffect(() => {
    localStorage.setItem(VIEW_STORAGE_KEY, view);
  }, [view]);

  return (
    <main className="flex h-full flex-col">
      <Toolbar
        view={view}
        onViewChange={setView}
        itemCount={files.length}
        showPermissions={showPermissions}
        onTogglePermissions={onTogglePermissions}
      />

      {/* File List/Grid */}
      <section className="flex-1 overflow-auto">
        {files.length === 0 ? (
          <EmptyState message="No files or folders" />
        ) : view === "grid" ? (
          <div className="grid grid-cols-2 gap-2 p-2 sm:grid-cols-3 sm:gap-3 sm:p-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {files.map((file) => (
              <FileItem
                key={file.id}
                file={file}
                view={view}
                onSelect={onFileSelect}
                onDoubleClick={onFileDoubleClick}
                onRename={onFileRename}
                onPreview={onFilePreview}
                onCopy={onFileCopy}
                onMove={onFileMove}
                onDownload={onFileDownload}
                onDelete={onFileDelete}
                onShare={onFileShare}
                isSelected={selectedFileIds.includes(file.id)}
                onContextMenu={onFileContextMenu}
              />
            ))}
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {showPermissions && (
              <div className="flex items-center gap-2 border-b border-gray-200 bg-gray-50 px-2 py-1.5 text-xs font-medium text-gray-500 sm:gap-4 sm:px-4">
                <div className="h-8 w-8 flex-shrink-0 sm:h-10 sm:w-10" />
                <div className="min-w-0 flex-1">Name</div>
                <div className="min-w-0 flex-1 hidden sm:block">Permissions</div>
                <div className="hidden flex-shrink-0 sm:block sm:w-32">Modified</div>
                <div className="hidden flex-shrink-0 md:block md:w-20">Size</div>
              </div>
            )}
            {files.map((file) => (
              <FileItem
                key={file.id}
                file={file}
                view={view}
                onSelect={onFileSelect}
                onDoubleClick={onFileDoubleClick}
                onRename={onFileRename}
                onPreview={onFilePreview}
                onCopy={onFileCopy}
                onMove={onFileMove}
                onDownload={onFileDownload}
                onDelete={onFileDelete}
                onShare={onFileShare}
                isSelected={selectedFileIds.includes(file.id)}
                onContextMenu={onFileContextMenu}
                accessResult={showPermissions ? permissionsMap[file.url] : undefined}
              />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

