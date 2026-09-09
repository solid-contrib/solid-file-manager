"use client";

import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Input } from "@/components/ui/input";
import { UrlString, getFile, overwriteFile, deleteFile, createContainerAt } from "@inrupt/solid-client";
import { toast } from "@/components/ui/toast";
import { FileItemData } from "./FileItem";
import { getAuthenticatedSession, sanitizeResourceName, getParentContainerUrl, ensureTrailingSlash, copyFolderContents, deleteFolderResource } from "../lib/helpers";

interface RenameDialogProps {
  isOpen: boolean;
  onClose: () => void;
  file: FileItemData | null;
  onRenamed?: (newUrl: string) => void;
}

export default function RenameDialog({
  isOpen,
  onClose,
  file,
  onRenamed,
}: RenameDialogProps) {
  const [newName, setNewName] = useState("");
  const [isRenaming, setIsRenaming] = useState(false);
  const [isLoadingName, setIsLoadingName] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && file) {
      setIsLoadingName(false);
      setIsRenaming(false);
      setNewName(file.name);
      // Focus and select the input text
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.select();
        }
      }, 100);
    }
  }, [isOpen, file]);

  const handleRename = async () => {
    if (!file || !newName.trim()) {
      toast.add({ title: "Please enter a name", type: "error" });
      return;
    }

    if (newName.trim() === file.name) {
      onClose();
      return;
    }

    setIsRenaming(true);

    try {
      const { fetch: fetchFn } = getAuthenticatedSession();
      const sanitizedName = sanitizeResourceName(newName.trim());
      const parentUrl = getParentContainerUrl(file.url);
      const parentWithSlash = ensureTrailingSlash(parentUrl);
      const encodedName = encodeURIComponent(sanitizedName);
      const isContainer = file.url.endsWith("/");
      const newUrl = isContainer ? `${parentWithSlash}${encodedName}/` : `${parentWithSlash}${encodedName}`;

      // Check if target already exists
      try {
        const response = await fetchFn(newUrl, { method: "HEAD" });
        if (response.status !== 404) {
          toast.add({ title: `A resource with the name "${sanitizedName}" already exists`, type: "error" });
          setIsRenaming(false);
          return;
        }
      } catch {
        // Continue if check fails
      }

      if (isContainer) {
        // For folders: create new container, copy contents recursively, delete old
        await createContainerAt(newUrl as UrlString, { fetch: fetchFn });
        
        await copyFolderContents(file.url, newUrl, fetchFn);
        
        await deleteFolderResource(file.url, fetchFn);
      } else {
        // For files: fetch, create at new URL, delete old
        const fileBlob = await getFile(file.url as UrlString, { fetch: fetchFn });
        const contentType = fileBlob.type || "application/octet-stream";
        
        await overwriteFile(newUrl as UrlString, fileBlob, {
          fetch: fetchFn,
          contentType,
        });
        
        await deleteFile(file.url as UrlString, { fetch: fetchFn });
      }
      
      toast.add({ title: `Renamed to "${sanitizedName}"`, type: "success" });
      
      // Notify parent to refresh
      if (onRenamed) {
        onRenamed(newUrl);
      }
      
      // Close modal
      onClose();
    } catch (error) {
      console.error("Failed to rename:", error);
      toast.add({ title: error instanceof Error
          ? `Failed to rename: ${error.message}`
          : "Failed to rename", type: "error" });
    } finally {
      setIsRenaming(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !isRenaming) {
      handleRename();
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  if (!file) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Rename</DialogTitle>
        </DialogHeader>
        <div className="py-2">
          <Input
            ref={inputRef}
            type="text"
            value={newName}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewName(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isLoadingName ? "Loading..." : "Enter new name"}
            disabled={isRenaming || isLoadingName}
          />
        </div>
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={onClose}
            disabled={isRenaming}
          >
            Cancel
          </Button>
          <Button
            variant="default"
            onClick={handleRename}
            disabled={isRenaming || isLoadingName || !newName.trim() || newName.trim() === file.name}
            aria-busy={isRenaming}
          >
            {isRenaming && <Spinner />}
            OK
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

