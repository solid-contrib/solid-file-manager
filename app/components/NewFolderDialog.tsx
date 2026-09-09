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
import { createContainerAt, getSolidDataset, UrlString } from "@inrupt/solid-client";
import { toast } from "@/components/ui/toast";
import { getAuthenticatedSession } from "../lib/helpers";

interface NewFolderDialogProps {
  isOpen: boolean;
  onClose: () => void;
  currentContainerUrl: string | null;
  onFolderCreated?: () => void;
}

export default function NewFolderDialog({
  isOpen,
  onClose,
  currentContainerUrl,
  onFolderCreated,
}: NewFolderDialogProps) {
  const [folderName, setFolderName] = useState("Untitled folder");
  const [isCreating, setIsCreating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setFolderName("Untitled folder");
      setIsCreating(false);
      // Focus and select the input text when modal opens
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.select();
        }
      }, 100);
    }
  }, [isOpen]);

  const handleCreate = async () => {
    if (!folderName.trim()) {
      toast.add({ title: "Please enter a folder name", type: "error" });
      return;
    }

    if (!currentContainerUrl) {
      toast.add({ title: "Please select a storage first", type: "error" });
      return;
    }

    setIsCreating(true);

    try {
      const { fetch: fetchFn } = getAuthenticatedSession();

      // Ensure the current container exists
      await getSolidDataset(currentContainerUrl, { fetch: fetchFn });

      // Create the new folder URL
      const sanitizedName = folderName.trim().replace(/[<>:"/\\|?*]/g, "");
      const newFolderUrl = currentContainerUrl.endsWith("/")
        ? `${currentContainerUrl}${sanitizedName}/`
        : `${currentContainerUrl}/${sanitizedName}/`;

      // Create the container
      await createContainerAt(newFolderUrl as UrlString, { fetch: fetchFn });

      // Small delay to ensure server has processed the creation
      await new Promise(resolve => setTimeout(resolve, 200));

      toast.add({ title: `Folder "${sanitizedName}" created successfully`, type: "success" });
      
      // Notify parent to refresh before closing
      if (onFolderCreated) {
        onFolderCreated();
      }
      
      onClose();
    } catch (error) {
      console.error("Failed to create folder:", error);
      toast.add({ title: error instanceof Error
          ? `Failed to create folder: ${error.message}`
          : "Failed to create folder", type: "error" });
    } finally {
      setIsCreating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !isCreating) {
      handleCreate();
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>New folder</DialogTitle>
        </DialogHeader>
        <div className="py-2">
          <Input
            ref={inputRef}
            type="text"
            value={folderName}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFolderName(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Untitled folder"
            disabled={isCreating}
          />
        </div>
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={onClose}
            disabled={isCreating}
          >
            Cancel
          </Button>
          <Button
            variant="default"
            onClick={handleCreate}
            disabled={isCreating || !folderName.trim()}
            aria-busy={isCreating}
          >
            {isCreating && <Spinner />}
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

