"use client";

import { useRef, useEffect } from "react";
import { overwriteFile, createContainerAt, UrlString } from "@inrupt/solid-client";
import toast from "react-hot-toast";
import { getAuthenticatedSession, sanitizeResourceName, ensureTrailingSlash } from "../lib/helpers";

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

    const uploadPromises: Promise<void>[] = [];
    const uploadedFiles: string[] = [];
    const failedFiles: string[] = [];
    const createdFolders = new Set<string>();

    // Process files maintaining folder structure
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      const relativePath = (file as any).webkitRelativePath || file.name;
      const pathParts = relativePath.split("/").filter(Boolean);
      
      if (pathParts.length === 0) continue;

      // The first part is the folder name, rest is the path inside
      const folderName = sanitizeResourceName(pathParts[0]);
      const filePath = pathParts.slice(1); // Path inside the folder

      // Create the base folder container if it doesn't exist
      const baseFolderUrl = ensureTrailingSlash(
        currentContainerUrl.endsWith("/")
          ? `${currentContainerUrl}${encodeURIComponent(folderName)}`
          : `${currentContainerUrl}/${encodeURIComponent(folderName)}`
      );

      if (!createdFolders.has(baseFolderUrl)) {
        try {
          await createContainerAt(baseFolderUrl as UrlString, { fetch: fetchFn });
          createdFolders.add(baseFolderUrl);
        } catch (error) {
          console.error(`Failed to create folder ${folderName}:`, error);
        }
      }

      // Build the full path for this file
      let currentPath = baseFolderUrl;
      
      // Create intermediate folders if needed
      for (let j = 0; j < filePath.length - 1; j++) {
        const folderPart = sanitizeResourceName(filePath[j]);
        const encodedFolderPart = encodeURIComponent(folderPart);
        currentPath = ensureTrailingSlash(`${currentPath}${encodedFolderPart}`);
        
        if (!createdFolders.has(currentPath)) {
          try {
            await createContainerAt(currentPath as UrlString, { fetch: fetchFn });
            createdFolders.add(currentPath);
          } catch (error) {
            console.error(`Failed to create subfolder ${folderPart}:`, error);
          }
        }
      }

      // Upload the file
      const fileName = sanitizeResourceName(filePath[filePath.length - 1]);
      const fileUrl = `${currentPath}${encodeURIComponent(fileName)}`;

      const uploadPromise = overwriteFile(
        fileUrl as UrlString,
        file,
        {
          contentType: file.type || "application/octet-stream",
          fetch: fetchFn,
        }
      )
        .then(() => {
          uploadedFiles.push(relativePath);
        })
        .catch((error) => {
          console.error(`Failed to upload ${relativePath}:`, error);
          failedFiles.push(relativePath);
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

