"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  EllipsisVertical,
  Pencil,
  Download,
  Copy,
  CircleArrowRight,
  Trash2,
  Eye,
  Share2,
} from "lucide-react";
import { FileItemData } from "./FileItem";

interface FileItemMenuProps {
  file: FileItemData;
  onRename?: (file: FileItemData) => void;
  onDownload?: (file: FileItemData) => void;
  onCopy?: (file: FileItemData) => void;
  onMove?: (file: FileItemData) => void;
  onDelete?: (file: FileItemData) => void;
  onPreview?: (file: FileItemData) => void;
  onShare?: (file: FileItemData) => void;
  position?: "top-right" | "right";
}

export default function FileItemMenu({
  file,
  onRename,
  onDownload,
  onCopy,
  onMove,
  onDelete,
  onPreview,
  onShare,
  position = "right",
}: FileItemMenuProps) {
  const run = (action: ((file: FileItemData) => void) | undefined) => {
    action?.(file);
  };

  const menu = (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            aria-label="More options"
            className={position === "top-right" ? "bg-background/90 hover:bg-background shadow-sm" : ""}
            onClick={(e) => e.stopPropagation()}
          />
        }
      >
        <EllipsisVertical className="h-4 w-4 sm:h-5 sm:w-5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        side={position === "top-right" ? "bottom" : "bottom"}
        className="min-w-48 w-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {file.type === "file" && (
          <DropdownMenuItem onClick={() => run(onPreview)}>
            <Eye />
            Preview
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={() => run(onRename)}>
          <Pencil />
          Rename
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => run(onDownload)}>
          <Download />
          Download
        </DropdownMenuItem>
        {file.type === "file" && (
          <DropdownMenuItem onClick={() => run(onCopy)}>
            <Copy />
            Make a Copy
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={() => run(onShare)}>
          <Share2 />
          Share
        </DropdownMenuItem>
        {file.type === "file" && (
          <DropdownMenuItem onClick={() => run(onMove)}>
            <CircleArrowRight />
            Move
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={() => run(onDelete)}>
          <Trash2 />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  if (position === "top-right") {
    return <div className="absolute top-2 right-2 z-10">{menu}</div>;
  }

  return <div className="relative shrink-0">{menu}</div>;
}
