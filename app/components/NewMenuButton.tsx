"use client";

import { Plus, FolderPlus, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface NewMenuButtonProps {
  currentContainerUrl: string | null;
  onNewFolderClick?: () => void;
  onFileUploadClick?: () => void;
  onFolderUploadClick?: () => void;
}

export default function NewMenuButton({
  onNewFolderClick,
  onFileUploadClick,
  onFolderUploadClick,
}: NewMenuButtonProps) {
  return (
    <div className="mb-4 px-2">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="default"
              className="w-full flex items-center justify-center gap-2"
              aria-label="New"
            />
          }
        >
          <Plus className="h-4 w-4" />
          <span>New</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-(--anchor-width) min-w-0">
          <DropdownMenuItem onClick={onNewFolderClick}>
            <FolderPlus className="h-5 w-5 text-muted-foreground" />
            New Folder
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onFileUploadClick}>
            <Upload className="h-5 w-5 text-muted-foreground" />
            File Upload
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onFolderUploadClick}>
            <FolderPlus className="h-5 w-5 text-muted-foreground" />
            Folder Upload
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
