"use client";

import { useRef } from "react";
import Button from "./shared/Button";
import { XMarkIcon } from "@heroicons/react/24/outline";
import NewMenuButton from "./NewMenuButton";
import GitHubLinks from "./shared/GitHubLinks";
import { useClickOutside } from "../lib/hooks";

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
  activeTab?: string;
  currentContainerUrl?: string | null;
  onNewFolderClick?: () => void;
  onFileUploadClick?: () => void;
  onFolderUploadClick?: () => void;
}

export default function Sidebar({
  isOpen = true,
  onClose,
  activeTab = "my-storages",
  currentContainerUrl,
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

  const navigationTabs = [
    { id: "my-storages", label: "My Storages" },
  ];

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
        className={`fixed left-0 top-0 z-50 h-full w-64 border-r border-gray-200 bg-white shadow-lg transition-transform lg:relative lg:z-auto lg:shadow-none lg:translate-x-0 ${
          isMobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
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
          
          {/* Navigation Tabs */}
          <ul className="space-y-1" role="list">
            {navigationTabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <li key={tab.id}>
                  <button
                    type="button"
                    className={`cursor-pointer w-full rounded-md px-3 py-2 text-left text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-[#F3EDFF] text-black"
                        : "text-gray-700 hover:bg-gray-100"
                    }`}
                    aria-current={isActive ? "page" : undefined}
                  >
                    {tab.label}
                  </button>
                </li>
              );
            })}
          </ul>

          {/* Footer links - pushed to bottom */}
          <div className="mt-auto border-t border-gray-200 pt-4">
            <GitHubLinks layout="vertical" />
          </div>
        </nav>
      </aside>
    </>
  );
}

