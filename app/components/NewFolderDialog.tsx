"use client";

import { useState, useEffect, useRef } from "react";
import Modal from "./shared/Modal";
import Button from "./shared/Button";
import Input from "./shared/Input";
import { getDefaultSession } from "@inrupt/solid-client-authn-browser";
import { createContainerAt, getSolidDataset, UrlString } from "@inrupt/solid-client";
import toast from "react-hot-toast";

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
      toast.error("Please enter a folder name");
      return;
    }

    if (!currentContainerUrl) {
      toast.error("Please select a storage first");
      return;
    }

    setIsCreating(true);

    try {
      const session = getDefaultSession();
      if (!session.info.isLoggedIn) {
        throw new Error("Not authenticated");
      }

      const fetchFn = session.fetch || fetch;

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

      toast.success(`Folder "${sanitizedName}" created successfully`);
      
      // Notify parent to refresh before closing
      if (onFolderCreated) {
        onFolderCreated();
      }
      
      onClose();
    } catch (error) {
      console.error("Failed to create folder:", error);
      toast.error(
        error instanceof Error
          ? `Failed to create folder: ${error.message}`
          : "Failed to create folder"
      );
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
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="New folder"
      maxWidth="sm"
      footer={
        <div className="flex justify-end gap-2">
          <Button
            variant="ghost"
            onClick={onClose}
            disabled={isCreating}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleCreate}
            isLoading={isCreating}
            disabled={isCreating || !folderName.trim()}
          >
            Create
          </Button>
        </div>
      }
    >
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
    </Modal>
  );
}

