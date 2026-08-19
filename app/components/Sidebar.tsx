"use client";

import { useRef } from "react";
import Button from "./shared/Button";
import { XMarkIcon } from "@heroicons/react/24/outline";
import NewMenuButton from "./NewMenuButton";
import GitHubLinks from "./shared/GitHubLinks";
import FolderTree from "./FolderTree";
import { useClickOutside } from "../lib/hooks";
import { SolidStorage } from "../lib/hooks/useSolidStorages";

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
  currentContainerUrl?: string | null;
  storages?: SolidStorage[];
  onFolderNavigate?: (folderUrl: string) => void;
  onNewFolderClick?: () => void;
  onFileUploadClick?: () => void;
  onFolderUploadClick?: () => void;
}

export default function Sidebar({
  isOpen = true,
  onClose,
  currentContainerUrl,
  storages,
  onFolderNavigate,
  onNewFolderClick,
  onFileUploadClick,
  onFolderUploadClick,
}: SidebarProps) {
  const isMobileOpen = isOpen;
  const sidebarRef = useRef<HTMLElement>(null);

  // Close sidebar when clicking outside on mobile (backdrop handles most cases, this is a fallback)
  useClickOutside({
    isEnabled: isMobileOpen,
    onOutsideClick: () => {
      if (onClose) {
        onClose();
      }
    },
    refs: [sidebarRef],
  });


  return (
    <>
      {/* Backdrop overlay for mobile */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 transition-opacity lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        ref={sidebarRef}
        className={`fixed left-0 top-0 z-50 h-full w-64 border-r border-gray-200 bg-white shadow-lg transition-transform lg:relative lg:z-auto lg:shadow-none lg:translate-x-0 ${isMobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
          }`}
      >
        <nav className="flex h-full flex-col p-2" aria-label="Navigation">
          {/* Header with close button on mobile */}
          <div className="mb-2 flex items-center justify-between border-b border-gray-200 pb-2 lg:border-0 lg:pb-0">
            <div className="flex-1" />
            {onClose && (
              <Button
                variant="icon"
                onClick={onClose}
                className="lg:hidden"
                aria-label="Close sidebar"
              >
                <XMarkIcon className="h-5 w-5" />
              </Button>
            )}
          </div>

          <NewMenuButton
            currentContainerUrl={currentContainerUrl || null}
            onNewFolderClick={onNewFolderClick}
            onFileUploadClick={onFileUploadClick}
            onFolderUploadClick={onFolderUploadClick}
          />

          <div className="mt-2 flex-1 overflow-y-auto">
            <p className="px-3 py-1 text-xs font-medium text-gray-500">My Storages</p>
            {storages && onFolderNavigate ? (
              <FolderTree
                storages={storages}
                currentFolderUrl={currentContainerUrl}
                onNavigate={onFolderNavigate}
              />
            ) : null}
          </div>

          {/* Footer links - pushed to bottom */}
          <div className="mt-auto border-t border-gray-200 pt-4">
            <GitHubLinks layout="vertical" />
          </div>
        </nav>
      </aside>
    </>
  );
}

