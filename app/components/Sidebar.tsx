"use client";

import Button from "./shared/Button";
import { XMarkIcon } from "@heroicons/react/24/outline";
import NewMenuButton from "./NewMenuButton";

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
  activeTab?: string;
  currentContainerUrl?: string | null;
  onNewFolderClick?: () => void;
  onFileUploadClick?: () => void;
}

export default function Sidebar({
  isOpen = true,
  onClose,
  activeTab = "my-storages",
  currentContainerUrl,
  onNewFolderClick,
  onFileUploadClick,
}: SidebarProps) {
  const isMobileOpen = isOpen;

  const navigationTabs = [
    { id: "my-storages", label: "My Storages" },
  ];

  return (
    <>
      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-14 z-50 h-[calc(100vh-3.5rem)] w-64 border-r border-gray-200 bg-white shadow-lg transition-transform lg:relative lg:top-0 lg:z-auto lg:h-full lg:shadow-none lg:translate-x-0 ${
          isMobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <nav className="p-2" aria-label="Navigation">
          <div className="mb-2 flex items-center justify-between px-3 py-2 lg:block">
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
        </nav>
      </aside>
    </>
  );
}

