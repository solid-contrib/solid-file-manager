"use client";

import { useRef, useEffect, type InputHTMLAttributes, useState } from "react";
import { toast } from "@/components/ui/toast";
import {
  getAuthenticatedSession,
  uploadFilesToContainer,
  uploadFolderFilesToContainer,
  findUploadConflicts,
  uploadFileWithConflictChoice,
  FolderUploadFile,
  type UploadConflictChoice,
  type UploadConflict,
} from "../lib/helpers";
import UploadConflictDialog from "./UploadConflictDialog";

type FileWithRelativePath = File & {
  webkitRelativePath?: string;
}
interface FileUploadHandlerProps {
  currentContainerUrl: string | null;
  onUploadComplete?: () => void;
  triggerUpload?: number;
  triggerFolderUpload?: number;
}

export default function FileUploadHandler({
  currentContainerUrl,
  onUploadComplete,
  triggerUpload,
  triggerFolderUpload,
}: FileUploadHandlerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const [activeConflict, setActiveConflict] = useState<UploadConflict | null>(null);
  const conflictResolverRef = useRef<((choice: UploadConflictChoice) => void) | null>(null);

  const resolveConflictChoice = (choice: UploadConflictChoice) => {
    const resolve = conflictResolverRef.current;
    conflictResolverRef.current = null;
    setActiveConflict(null);
    resolve?.(choice);
  }

  const askConflictChoice = (conflict: UploadConflict) =>
    new Promise<UploadConflictChoice>((resolve) => {
      conflictResolverRef.current = resolve;
      setActiveConflict(conflict);
    });

  useEffect(() => {
    if (triggerUpload && triggerUpload > 0 && fileInputRef.current) {
      fileInputRef.current.click();
    }
  }, [triggerUpload]);

  useEffect(() => {
    if (triggerFolderUpload && triggerFolderUpload > 0 && folderInputRef.current) {
      folderInputRef.current.click();
    }
  }, [triggerFolderUpload]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (!currentContainerUrl) {
      toast.add({ title: "Please select a storage first", type: "error" });
      e.target.value = "";
      return;
    }

    let fetchFn: typeof fetch;
    try {
      ({ fetch: fetchFn } = getAuthenticatedSession());
    } catch {
      toast.add({ title: "Not authenticated", type: "error" });
      e.target.value = "";
      return;
    }

    try {
      const selectedFiles = Array.from(files);
      const { newFiles, conflicts } = await findUploadConflicts(
        selectedFiles,
        currentContainerUrl,
        fetchFn,
      );

      const uploadedFiles: string[] = [];
      const failedFiles: string[] = [];

      if (newFiles.length > 0) {
        const result = await uploadFilesToContainer(
          newFiles,
          currentContainerUrl,
          fetchFn,
        );
        uploadedFiles.push(...result.uploadedFiles);
        failedFiles.push(...result.failedFiles);
      }

      for (const conflict of conflicts) {
        const choice = await askConflictChoice(conflict);
        if (choice === "cancel") {
          continue;
        }

        try {
          const { uploadedName } = await uploadFileWithConflictChoice(
            conflict,
            choice,
            currentContainerUrl,
            fetchFn,
          );
          uploadedFiles.push(uploadedName);
        } catch {
          failedFiles.push(conflict.existingName);
        }
      }

      if (uploadedFiles.length > 0) {
        const message =
          uploadedFiles.length === 1
            ? `File uploaded successfully`
            : `${uploadedFiles.length} files uploaded successfully`;
        toast.add({ title: message, type: "success" });
      }

      if (failedFiles.length > 0) {
        const message =
          failedFiles.length === 1
            ? `Failed to upload "${failedFiles[0]}"`
            : `Failed to upload ${failedFiles.length} files`;
        toast.add({ title: message, type: "error" });
      }

      if (uploadedFiles.length > 0 && onUploadComplete) {
        await new Promise((resolve) => setTimeout(resolve, 200));
        onUploadComplete();
      }
    } catch (error) {
      console.error("Upload error:", error);
      toast.add({ title: "Failed to upload files", type: "error" });
    } finally {
      e.target.value = "";
    }
  };

  const handleFolderChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (!currentContainerUrl) {
      toast.add({ title: "Please select a storage first", type: "error" });
      e.target.value = "";
      return;
    }

    let fetchFn: typeof fetch;
    try {
      ({ fetch: fetchFn } = getAuthenticatedSession());
    } catch {
      toast.add({ title: "Not authenticated", type: "error" });
      e.target.value = "";
      return;
    }

    const folderFiles: FolderUploadFile[] = Array.from(files)
      .map((file) => ({
        file,
        relativePath: (file as FileWithRelativePath).webkitRelativePath || file.name,
      }))
      .filter((item) => item.relativePath && item.relativePath.length > 0);

    try {
      const { uploadedFiles, failedFiles } = await uploadFolderFilesToContainer(
        folderFiles,
        currentContainerUrl,
        fetchFn
      );

      if (uploadedFiles.length > 0) {
        const message =
          uploadedFiles.length === 1
            ? `File uploaded successfully`
            : `${uploadedFiles.length} files uploaded successfully`;
        toast.add({ title: message, type: "success" });
      }

      if (failedFiles.length > 0) {
        const message =
          failedFiles.length === 1
            ? `Failed to upload "${failedFiles[0]}"`
            : `Failed to upload ${failedFiles.length} files`;
        toast.add({ title: message, type: "error" });
      }

      if (uploadedFiles.length > 0 && onUploadComplete) {
        await new Promise((resolve) => setTimeout(resolve, 200));
        onUploadComplete();
      }
    } catch (error) {
      console.error("Upload error:", error);
      toast.add({ title: "Failed to upload folder", type: "error" });
    } finally {
      e.target.value = "";
    }
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFileChange}
      />
      <input
        ref={folderInputRef}
        type="file"
        {...({ webkitdirectory: "" } as InputHTMLAttributes<HTMLInputElement>)}
        multiple
        className="hidden"
        onChange={handleFolderChange}
      />
      <UploadConflictDialog
        isOpen={activeConflict !== null}
        fileName={activeConflict?.existingName ?? null}
        onReplace={() => resolveConflictChoice("replace")}
        onKeepBoth={() => resolveConflictChoice("keepBoth")}
        onCancel={() => resolveConflictChoice("cancel")}
      />
    </>
  );
}

