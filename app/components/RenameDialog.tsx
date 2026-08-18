"use client";

import { getAuthFetch } from "../lib/auth/manager";

import { useState, useEffect, useRef } from "react";
import Modal from "./shared/Modal";
import Button from "./shared/Button";
import Input from "./shared/Input";
import { UrlString, getFile, overwriteFile, deleteFile, createContainerAt } from "@inrupt/solid-client";
import toast from "react-hot-toast";
import { FileItemData } from "./FileItem";
import { sanitizeResourceName, getParentContainerUrl, ensureTrailingSlash, copyFolderContents, deleteFolderResource } from "../lib/helpers";

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
      toast.error("Please enter a name");
      return;
    }

    if (newName.trim() === file.name) {
      onClose();
      return;
    }

    setIsRenaming(true);

    try {
      const fetchFn = getAuthFetch();
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
          toast.error(`A resource with the name "${sanitizedName}" already exists`);
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
      
      toast.success(`Renamed to "${sanitizedName}"`);
      
      // Notify parent to refresh
      if (onRenamed) {
        onRenamed(newUrl);
      }
      
      // Close modal
      onClose();
    } catch (error) {
      console.error("Failed to rename:", error);
      toast.error(
        error instanceof Error
          ? `Failed to rename: ${error.message}`
          : "Failed to rename"
      );
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
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Rename"
      maxWidth="sm"
      footer={
        <div className="flex justify-end gap-2">
          <Button
            variant="ghost"
            onClick={onClose}
            disabled={isRenaming}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleRename}
            isLoading={isRenaming}
            disabled={isRenaming || isLoadingName || !newName.trim() || newName.trim() === file.name}
          >
            OK
          </Button>
        </div>
      }
    >
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
    </Modal>
  );
}

