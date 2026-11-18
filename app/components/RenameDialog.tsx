"use client";

import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { FileItemData } from "./FileItem";
import { sanitizeResourceName, renameResource, NameTakenError } from "../lib/helpers";
import { useSolidFetch } from "./providers/SolidFetchProvider";

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
  const fetchFn = useSolidFetch();
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
      const sanitizedName = sanitizeResourceName(newName.trim());
      const { url: newUrl, sourceRemoved, keptBecause } = await renameResource(file, sanitizedName, fetchFn);

      toast.add(
        sourceRemoved
          ? { title: `Renamed to "${sanitizedName}"`, type: "success" }
          : {
              title:
                keptBecause === "changed"
                  ? `Saved as "${sanitizedName}", but the original was changed meanwhile, so it was kept. Please check both`
                  : keptBecause === "unverified"
                    ? `Saved as "${sanitizedName}", but the server can't confirm the original is unchanged, so it was kept. Please check both`
                    : file.url.endsWith("/")
                    ? `Copied to "${sanitizedName}", but the original folder couldn't be fully removed; what's left of it is still there`
                    : `Saved as "${sanitizedName}", but the original couldn't be removed, so both now exist`,
              type: "error",
            },
      );

      // Notify parent to refresh
      if (onRenamed) {
        onRenamed(newUrl);
      }

      // Close modal
      onClose();
    } catch (error) {
      console.error("Failed to rename:", error);
      toast.add({
        title:
          error instanceof NameTakenError
            ? `A resource with the name "${error.newName}" already exists`
            : error instanceof Error
              ? `Failed to rename: ${error.message}`
              : "Failed to rename",
        type: "error",
      });
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
          <DialogDescription className="truncate">
            {file.name}
          </DialogDescription>
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
            Rename
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

