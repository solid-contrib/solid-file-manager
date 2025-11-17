"use client";

import { useState, useEffect } from "react";
import FileItem, { FileItemData } from "./FileItem";
import Toolbar from "./shared/Toolbar";
import EmptyState from "./shared/EmptyState";

interface FileListProps {
  files: FileItemData[];
  currentPath: string;
  onFileSelect: (file: FileItemData) => void;
  onFileDoubleClick: (file: FileItemData) => void;
  onFileRename?: (file: FileItemData) => void;
  onFilePreview?: (file: FileItemData) => void;
  selectedFileIds: string[];
}

const VIEW_STORAGE_KEY = "solid-file-manager-view";

export default function FileList({
  files,
  currentPath,
  onFileSelect,
  onFileDoubleClick,
  onFileRename,
  onFilePreview,
  selectedFileIds,
}: FileListProps) {
  const [view, setView] = useState<"grid" | "list">(() => {
    if (typeof window === "undefined") return "list";
    const stored = localStorage.getItem(VIEW_STORAGE_KEY);
    return (stored === "grid" || stored === "list") ? stored : "list";
  });

  useEffect(() => {
    localStorage.setItem(VIEW_STORAGE_KEY, view);
  }, [view]);

  return (
    <main className="flex h-full flex-col">
      <Toolbar
        view={view}
        onViewChange={setView}
        itemCount={files.length}
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
                isSelected={selectedFileIds.includes(file.id)}
              />
            ))}
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {files.map((file) => (
              <FileItem
                key={file.id}
                file={file}
                view={view}
                onSelect={onFileSelect}
                onDoubleClick={onFileDoubleClick}
                onRename={onFileRename}
                onPreview={onFilePreview}
                isSelected={selectedFileIds.includes(file.id)}
              />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

