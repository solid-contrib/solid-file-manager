"use client";

import { useCallback, useState } from "react";
import toast from "react-hot-toast";
import type { FileItemData } from "../../FileItem";
import type { AccessLevel } from "../../ShareDialog";
import {
  getAuthenticatedSession,
  copyFileResource,
  copyFolderResource,
  downloadFile,
  downloadFolderAsZip,
  deleteFileResource,
  deleteFolderResource,
} from "@/app/lib/helpers";
import { shareResourceWithAcp } from "@/app/lib/helpers/acpUtils";
import type { FileAction } from "../types/fileActions";

async function runWithToast<T>(
  loadingMessage: string,
  action: () => Promise<T>,
  options: {
    successMessage: string | ((result: T) => string);
    errorFallback: string;
    errorPrefix?: string;
  },
): Promise<T | null> {
  const toastId = toast.loading(loadingMessage);
  try {
    const result = await action();
    const success =
      typeof options.successMessage === "function"
        ? options.successMessage(result)
        : options.successMessage;
    toast.success(success, { id: toastId });
    return result;
  } catch (error) {
    console.error(options.errorFallback, error);
    toast.error(
      error instanceof Error
        ? `${options.errorPrefix ?? "Failed"}: ${error.message}`
        : options.errorFallback,
      { id: toastId },
    );
    return null;
  }
}

export interface FileOperationDialogHandlers {
  openRenameDialog: (file: FileItemData) => void;
  openPreviewDialog: (file: FileItemData) => void;
  openMoveDialog: (file: FileItemData) => void;
  openDeleteDialog: (file: FileItemData) => void;
  openShareDialog: (file: FileItemData) => void;
  openNewFolderDialog: () => void;
  triggerFileUpload: () => void;
  triggerFolderUpload: () => void;
}

export interface UseFileOperationsOptions {
  OnRefresh: () => void;
  OnAfterDelete?: (fileId: string) => void;
  dialogHandlers: FileOperationDialogHandlers;
}

export interface ShareOperationResult {
  resourceUrl: string;
  resourceName: string;
}

export interface UseFileOperationsResult {
  isDeleting: boolean;
  dispatchFileAction: (action: FileAction) => void;
  copyFile: (file: FileItemData) => Promise<void>;
  downloadFile: (file: FileItemData) => Promise<void>;
  confirmDelete: (file: FileItemData) => Promise<void>;
  confirmShare: (
    file: FileItemData,
    webIds: string[],
    accessLevel: AccessLevel,
  ) => Promise<ShareOperationResult | null>;
}

export function useFileOperations({
  OnRefresh,
  OnAfterDelete,
  dialogHandlers,
}: UseFileOperationsOptions): UseFileOperationsResult {
  const [isDeleting, setIsDeleting] = useState(false);

  const copyFile = useCallback(
    async (file: FileItemData) => {
      if (!file) {
        return;
      }

      const result = await runWithToast(
        `Copying "${file.name}"...`,
        async () => {
          const { fetch: fetchFn } = getAuthenticatedSession();
          if (file.type === "folder") {
            await copyFolderResource(file, fetchFn);
          } else {
            await copyFileResource(file, fetchFn);
          }
        },
        {
          successMessage: `Copied "${file.name}"`,
          errorFallback: "Failed to copy resource",
          errorPrefix: "Failed to copy",
        },
      );

      if (result !== null) {
        OnRefresh();
      }
    },
    [OnRefresh],
  );

  const downloadFileResource = useCallback(async (file: FileItemData) => {
    if (!file) {
      return;
    }
    await runWithToast(
      file.type === "folder"
        ? `Preparing "${file.name}" for download...`
        : `Downloading "${file.name}"...`,
      async () => {
        const { fetch: fetchFn } = getAuthenticatedSession();
        if (file.type === "folder") {
          await downloadFolderAsZip(file.url, file.name, fetchFn);
          return `${file.name}.zip`;
        }
        await downloadFile(file.url, file.name, fetchFn);
        return file.name;
      },
      {
        successMessage: (name) => `Downloaded "${name}"`,
        errorFallback: "Failed to download resource",
        errorPrefix: "Failed to download",
      },
    );
  }, []);

  const confirmDelete = useCallback(
    async (file: FileItemData) => {
      setIsDeleting(true);

      const result = await runWithToast(
        `Deleting "${file.name}"...`,
        async () => {
          const { fetch: fetchFn } = getAuthenticatedSession();
          if (file.type === "folder") {
            await deleteFolderResource(file.url, fetchFn);
          } else {
            await deleteFileResource(file.url, fetchFn);
          }
        },
        {
          successMessage: `Deleted "${file.name}"`,
          errorFallback: "Failed to delete resource",
          errorPrefix: "Failed to delete",
        },
      );
      setIsDeleting(false);

      if (result === null) {
        return;
      }

      OnAfterDelete?.(file.id);
      setTimeout(() => {
        OnRefresh();
      }, 1000);
    },
    [OnAfterDelete, OnRefresh],
  );

  const confirmShare = useCallback(
    async (
      file: FileItemData,
      webIds: string[],
      accessLevel: AccessLevel,
    ): Promise<ShareOperationResult | null> => {
      return runWithToast(
        `Sharing "${file.name}"...`,
        async () => {
          let resourceUrl = file.url;
          if (file.type === "folder" && !resourceUrl.endsWith("/")) {
            resourceUrl += "/";
          }

          await shareResourceWithAcp(resourceUrl, webIds, accessLevel);

          return {
            resourceUrl,
            resourceName: file.name,
          };
        },
        {
          successMessage: `Successfully shared "${file.name}"`,
          errorFallback: "Failed to share resource",
          errorPrefix: "Failed to share",
        },
      );
    },
    [],
  );

  const dispatchFileAction = useCallback(
    (action: FileAction) => {
      switch (action.type) {
        case "rename":
          dialogHandlers.openRenameDialog(action.file);
          break;
        case "preview":
          dialogHandlers.openPreviewDialog(action.file);
          break;
        case "copy":
          void copyFile(action.file);
          break;
        case "move":
          dialogHandlers.openMoveDialog(action.file);
          break;
        case "download":
          void downloadFileResource(action.file);
          break;
        case "delete":
          dialogHandlers.openDeleteDialog(action.file);
          break;
        case "share":
          dialogHandlers.openShareDialog(action.file);
          break;
        case "openNewFolder":
          dialogHandlers.openNewFolderDialog();
          break;
        case "triggerFileUpload":
          dialogHandlers.triggerFileUpload();
          break;
        case "triggerFolderUpload":
          dialogHandlers.triggerFolderUpload();
          break;
        default: {
          const _exhaustive: never = action;
          return _exhaustive;
        }
      }
    },
    [copyFile, dialogHandlers, downloadFileResource],
  );

  return {
    isDeleting,
    dispatchFileAction,
    copyFile,
    downloadFile: downloadFileResource,
    confirmDelete,
    confirmShare,
  };
}
