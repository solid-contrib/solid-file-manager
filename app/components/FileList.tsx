"use client";

import { useState } from "react";
import FileItem, { FileItemData } from "./FileItem";

interface FileListProps {
  files: FileItemData[];
  currentPath: string;
  onFileSelect: (file: FileItemData) => void;
  onFileDoubleClick: (file: FileItemData) => void;
  selectedFileIds: string[];
}

export default function FileList({
  files,
  currentPath,
  onFileSelect,
  onFileDoubleClick,
  selectedFileIds,
}: FileListProps) {
  const [view, setView] = useState<"grid" | "list">("list");

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-gray-200 px-2 py-2 sm:px-4">
        <div className="flex items-center gap-1 sm:gap-2">
          <button
            type="button"
            onClick={() => setView("list")}
            className={`cursor-pointer rounded-md p-1.5 sm:p-2 ${
              view === "list"
                ? "bg-purple-100 text-black"
                : "text-gray-600 hover:bg-gray-100"
            }`}
            aria-label="List view"
            aria-pressed={view === "list"}
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
                d="M4 6h16M4 10h16M4 14h16M4 18h16"
              />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => setView("grid")}
            className={`cursor-pointer rounded-md p-1.5 sm:p-2 ${
              view === "grid"
                ? "bg-purple-100 text-black"
                : "text-gray-600 hover:bg-gray-100"
            }`}
            aria-label="Grid view"
            aria-pressed={view === "grid"}
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
                d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
              />
            </svg>
          </button>
        </div>
        <div className="text-xs text-gray-600 sm:text-sm">
          {files.length} {files.length === 1 ? "item" : "items"}
        </div>
      </div>

      {/* File List/Grid */}
      <div className="flex-1 overflow-auto">
        {files.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <p className="text-gray-500">No files or folders</p>
            </div>
          </div>
        ) : view === "grid" ? (
          <div className="grid grid-cols-2 gap-2 p-2 sm:grid-cols-3 sm:gap-3 sm:p-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {files.map((file) => (
              <FileItem
                key={file.id}
                file={file}
                view={view}
                onSelect={onFileSelect}
                onDoubleClick={onFileDoubleClick}
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
                isSelected={selectedFileIds.includes(file.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

