"use client";

import { useRef, useEffect } from "react";
import toast from "react-hot-toast";
import {
  getAuthenticatedSession,
  uploadFilesToContainer,
  uploadFolderFilesToContainer,
  FolderUploadFile,
} from "../lib/helpers";

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
      toast.error("Please select a storage first");
      e.target.value = "";
      return;
    }

    let fetchFn: typeof fetch;
    try {
      ({ fetch: fetchFn } = getAuthenticatedSession());
    } catch (error) {
      toast.error("Not authenticated");
      e.target.value = "";
      return;
    }
    try {
      const { uploadedFiles, failedFiles } = await uploadFilesToContainer(
        Array.from(files),
        currentContainerUrl,
        fetchFn
      );

      if (uploadedFiles.length > 0) {
        const message =
          uploadedFiles.length === 1
            ? `File uploaded successfully`
            : `${uploadedFiles.length} files uploaded successfully`;
        toast.success(message);
      }

      if (failedFiles.length > 0) {
        const message =
          failedFiles.length === 1
            ? `Failed to upload "${failedFiles[0]}"`
            : `Failed to upload ${failedFiles.length} files`;
        toast.error(message);
      }

      if (uploadedFiles.length > 0 && onUploadComplete) {
        await new Promise((resolve) => setTimeout(resolve, 200));
        onUploadComplete();
      }
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Failed to upload files");
    } finally {
      e.target.value = "";
    }
  };

  const handleFolderChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (!currentContainerUrl) {
      toast.error("Please select a storage first");
      e.target.value = "";
      return;
    }

    let fetchFn: typeof fetch;
    try {
      ({ fetch: fetchFn } = getAuthenticatedSession());
    } catch (error) {
      toast.error("Not authenticated");
      e.target.value = "";
      return;
    }

    const folderFiles: FolderUploadFile[] = Array.from(files)
      .map((file) => ({
        file,
        relativePath: (file as any).webkitRelativePath || file.name,
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
        toast.success(message);
      }

      if (failedFiles.length > 0) {
        const message =
          failedFiles.length === 1
            ? `Failed to upload "${failedFiles[0]}"`
            : `Failed to upload ${failedFiles.length} files`;
        toast.error(message);
      }

      if (uploadedFiles.length > 0 && onUploadComplete) {
        await new Promise((resolve) => setTimeout(resolve, 200));
        onUploadComplete();
      }
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Failed to upload folder");
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
        {...({ webkitdirectory: "" } as any)}
        multiple
        className="hidden"
        onChange={handleFolderChange}
      />
    </>
  );
}

