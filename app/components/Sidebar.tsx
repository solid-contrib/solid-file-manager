"use client";

import Image from "next/image";
import NewMenuButton from "./NewMenuButton";
import GitHubLinks from "./shared/GitHubLinks";
import FolderTree from "./FolderTree";
import { SolidStorage } from "../lib/hooks/useSolidStorages";
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";

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

function SidebarNav({
  currentContainerUrl,
  storages,
  onFolderNavigate,
  onNewFolderClick,
  onFileUploadClick,
  onFolderUploadClick,
}: Omit<SidebarProps, "isOpen" | "onClose">) {
  return (
    <nav className="flex h-full flex-col" aria-label="Navigation">
      <NewMenuButton
        currentContainerUrl={currentContainerUrl || null}
        onNewFolderClick={onNewFolderClick}
        onFileUploadClick={onFileUploadClick}
        onFolderUploadClick={onFolderUploadClick}
      />

      <div className="mt-2 flex-1 overflow-y-auto">
        <p className="px-3 py-1 text-xs font-medium text-muted-foreground">
          My Storages
        </p>
        {storages && onFolderNavigate ? (
          <FolderTree
            storages={storages}
            currentFolderUrl={currentContainerUrl}
            onNavigate={onFolderNavigate}
          />
        ) : null}
      </div>

      <div className="mt-auto border-t border-border pt-4">
        <GitHubLinks layout="vertical" />
      </div>
    </nav>
  );
}

export default function Sidebar({
  isOpen = false,
  onClose,
  currentContainerUrl,
  storages,
  onFolderNavigate,
  onNewFolderClick,
  onFileUploadClick,
  onFolderUploadClick,
}: SidebarProps) {
  const navProps = {
    currentContainerUrl,
    storages,
    onFolderNavigate,
    onNewFolderClick,
    onFileUploadClick,
    onFolderUploadClick,
  };

  return (
    <>
      {/* Desktop: always visible */}
      <aside className="hidden h-full w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar p-2 text-sidebar-foreground lg:flex">
        <SidebarNav {...navProps} />
      </aside>

      {/* Mobile: Sheet drawer */}
      <Sheet
        open={isOpen}
        onOpenChange={(open) => {
          if (!open) onClose?.();
        }}
      >
        <SheetContent
          side="left"
          className="w-64 gap-0 bg-sidebar p-2 text-sidebar-foreground sm:max-w-64"
        >
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <div className="flex items-center justify-center py-3">
            <Image
              src="/file-manager-logo.svg"
              alt="Solid File Manager"
              width={48}
              height={48}
              className="h-12 w-12"
            />
          </div>
          <SidebarNav {...navProps} />
        </SheetContent>
      </Sheet>
    </>
  );
}
