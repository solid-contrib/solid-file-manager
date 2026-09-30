"use client";

import Image from "next/image";
import NewMenuButton from "./NewMenuButton";
import GitHubLinks from "./shared/GitHubLinks";
import FolderTree from "./FolderTree";
import { SolidStorage } from "../lib/hooks/useSolidStorages";
import {
  Sidebar as SidebarPrimitive,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  useSidebar,
} from "@/components/ui/sidebar";

interface AppSidebarProps {
  currentContainerUrl?: string | null;
  storages?: SolidStorage[];
  onFolderNavigate?: (folderUrl: string) => void;
  onNewFolderClick?: () => void;
  onFileUploadClick?: () => void;
  onFolderUploadClick?: () => void;
}

export default function AppSidebar({
  currentContainerUrl,
  storages,
  onFolderNavigate,
  onNewFolderClick,
  onFileUploadClick,
  onFolderUploadClick,
}: AppSidebarProps) {
  const { isMobile, setOpenMobile } = useSidebar();

  const handleNavigate = (folderUrl: string) => {
    onFolderNavigate?.(folderUrl);
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  return (
    <SidebarPrimitive collapsible="offcanvas">
      <SidebarHeader className="items-center py-3">
        <Image
          src="/file-manager-logo.svg"
          alt="Solid File Manager"
          width={48}
          height={48}
          className="h-12 w-12"
          priority
        />
      </SidebarHeader>

      <SidebarContent className="p-2">
        <NewMenuButton
          currentContainerUrl={currentContainerUrl || null}
          onNewFolderClick={onNewFolderClick}
          onFileUploadClick={onFileUploadClick}
          onFolderUploadClick={onFolderUploadClick}
        />

        <SidebarGroup>
          <SidebarGroupLabel>My Storages</SidebarGroupLabel>
          <SidebarGroupContent>
            {storages && onFolderNavigate ? (
              <FolderTree
                storages={storages}
                currentFolderUrl={currentContainerUrl}
                onNavigate={handleNavigate}
              />
            ) : null}
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <GitHubLinks layout="vertical" />
      </SidebarFooter>
    </SidebarPrimitive>
  );
}
