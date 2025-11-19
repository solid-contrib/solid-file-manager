"use client";

import { useState, useEffect, useRef } from "react";
import Modal from "./shared/Modal";
import Button from "./shared/Button";
import Input from "./shared/Input";
import { UrlString } from "@inrupt/solid-client";
import toast from "react-hot-toast";
import { FileItemData } from "./FileItem";
import { updateMetaFile, getAuthenticatedSession } from "../lib/helpers";

interface RenameDialogProps {
  isOpen: boolean;
  onClose: () => void;
  file: FileItemData | null;
  onRenamed?: () => void;
}

export default function RenameDialog({
  isOpen,
  onClose,
  file,
  onRenamed,
}: RenameDialogProps) {
  const [newName, setNewName] = useState("");
  const [isRenaming, setIsRenaming] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && file) {
      setNewName(file.name);
      setIsRenaming(false);
      // Focus and select the input text when modal opens
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

    // Define variables outside try block so they're accessible in catch
    const sanitizedName = newName.trim();
    const resourceUrl = file.url.endsWith("/") ? file.url : file.url;
    const resourceUrlString = resourceUrl as UrlString;

    try {
      const { fetch: fetchFn } = getAuthenticatedSession();

      // Update the .meta file for this resource
      // This is the standard Solid approach for storing metadata about resources
      await updateMetaFile(resourceUrlString, sanitizedName, fetchFn);
      
      toast.success(`Renamed to "${sanitizedName}"`);
      onClose();
      
      // Notify parent to refresh
      if (onRenamed) {
        onRenamed();
      }
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
            disabled={isRenaming || !newName.trim() || newName.trim() === file.name}
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
          placeholder="Enter new name"
          disabled={isRenaming}
        />
      </div>
    </Modal>
  );
}

