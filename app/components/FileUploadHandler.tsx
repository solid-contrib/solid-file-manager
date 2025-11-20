"use client";

import { useRef, useEffect } from "react";
import { overwriteFile, UrlString } from "@inrupt/solid-client";
import toast from "react-hot-toast";
import { getAuthenticatedSession } from "../lib/helpers";

interface FileUploadHandlerProps {
  currentContainerUrl: string | null;
  onUploadComplete?: () => void;
  triggerUpload?: number;
}

export default function FileUploadHandler({
  currentContainerUrl,
  onUploadComplete,
  triggerUpload,
}: FileUploadHandlerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (triggerUpload && triggerUpload > 0 && fileInputRef.current) {
      fileInputRef.current.click();
    }
  }, [triggerUpload]);

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
    const uploadPromises: Promise<void>[] = [];
    const uploadedFiles: string[] = [];
    const failedFiles: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const sanitizedName = file.name.replace(/[<>:"/\\|?*]/g, "");
      const fileUrl = currentContainerUrl.endsWith("/")
        ? `${currentContainerUrl}${sanitizedName}`
        : `${currentContainerUrl}/${sanitizedName}`;

      const uploadPromise = overwriteFile(
        fileUrl as UrlString,
        file,
        {
          contentType: file.type || "application/octet-stream",
          fetch: fetchFn,
        }
      )
        .then(() => {
          uploadedFiles.push(sanitizedName);
        })
        .catch((error) => {
          console.error(`Failed to upload ${file.name}:`, error);
          failedFiles.push(sanitizedName);
        });

      uploadPromises.push(uploadPromise);
    }

    try {
      await Promise.all(uploadPromises);

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

  return (
    <input
      ref={fileInputRef}
      type="file"
      multiple
      className="hidden"
      onChange={handleFileChange}
    />
  );
}

