"use client";

import { useState, useRef } from "react";
import { PlusIcon, FolderPlusIcon, ArrowUpTrayIcon } from "@heroicons/react/24/outline";
import { useClickOutside } from "../lib/hooks";
import Button from "./shared/Button";

interface NewMenuButtonProps {
  currentContainerUrl: string | null;
  onNewFolderClick?: () => void;
  onFileUploadClick?: () => void;
  onFolderUploadClick?: () => void;
}

export default function NewMenuButton({
  currentContainerUrl,
  onNewFolderClick,
  onFileUploadClick,
  onFolderUploadClick,
}: NewMenuButtonProps) {
  const [showNewMenu, setShowNewMenu] = useState(false);
  const newMenuRef = useRef<HTMLDivElement>(null);
  const newButtonRef = useRef<HTMLButtonElement>(null);

  useClickOutside({
    isEnabled: showNewMenu,
    onOutsideClick: () => setShowNewMenu(false),
    refs: [newMenuRef, newButtonRef],
  });

  const handleNewFolder = () => {
    setShowNewMenu(false);
    if (onNewFolderClick) {
      onNewFolderClick();
    }
  };

  const handleFileUpload = () => {
    setShowNewMenu(false);
    if (onFileUploadClick) {
      onFileUploadClick();
    }
  };

  const handleFolderUpload = () => {
    setShowNewMenu(false);
    if (onFolderUploadClick) {
      onFolderUploadClick();
    }
  };

  return (
    <div className="relative mb-4 px-2">
      <Button
        ref={newButtonRef}
        variant="primary"
        onClick={(e) => {
          e.stopPropagation();
          setShowNewMenu(!showNewMenu);
        }}
        className="w-full flex items-center justify-center gap-2"
        aria-label="New"
        aria-expanded={showNewMenu}
      >
        <PlusIcon className="h-4 w-4" />
        <span>New</span>
      </Button>

      {/* New Menu Dropdown */}
      {showNewMenu && (
        <div
          ref={newMenuRef}
          className="absolute left-2 right-2 top-full mt-1 z-[100] rounded-lg bg-white border border-gray-200 shadow-lg overflow-hidden"
          role="menu"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={handleNewFolder}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-100 transition-colors border-b border-gray-100 cursor-pointer"
            role="menuitem"
          >
            <FolderPlusIcon className="h-5 w-5 text-gray-500" />
            <span>New Folder</span>
          </button>
          <button
            type="button"
            onClick={handleFileUpload}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-100 transition-colors border-b border-gray-100 cursor-pointer"
            role="menuitem"
          >
            <ArrowUpTrayIcon className="h-5 w-5 text-gray-500" />
            <span>File Upload</span>
          </button>
          <button
            type="button"
            onClick={handleFolderUpload}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
            role="menuitem"
          >
            <FolderPlusIcon className="h-5 w-5 text-gray-500" />
            <span>Folder Upload</span>
          </button>
        </div>
      )}
    </div>
  );
}

