"use client";

import { useCallback, useState } from "react";
import { toast } from "@/components/ui/toast";
import type { FileItemData } from "../../FileItem";
import type { AccessLevel } from "../../ShareDialog";
import {
  copyFileResource,
  downloadFile,
  downloadFolderAsZip,
  deleteFileResource,
  deleteFolderResource,
} from "@/app/lib/helpers";
import { shareResource } from "@/app/lib/helpers/sharing";
import type { FileAction } from "../types/fileActions";
import { useSolidFetch } from "../../providers/SolidFetchProvider";
import { useSolidAuth } from "@ldo/solid-react";

async function runWithToast<T>(
  loadingMessage: string,
  action: () => Promise<T>,
  options: {
    successMessage: string | ((result: T) => string);
    errorFallback: string;
    errorPrefix?: string;
  },
): Promise<T | null> {
  const toastId = toast.add({ title: loadingMessage, type: "loading" });
  try {
    const result = await action();
    const success =
      typeof options.successMessage === "function"
        ? options.successMessage(result)
        : options.successMessage;
    toast.update(toastId, { title: success, type: "success" });
    return result;
  } catch (error) {
    console.error(options.errorFallback, error);
    toast.update(toastId, {
      title:
        error instanceof Error
          ? `${options.errorPrefix ?? "Failed"}: ${error.message}`
          : options.errorFallback,
      type: "error",
    });
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
  onRefresh: () => void;
  onAfterDelete?: (fileId: string) => void;
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
  confirmDelete: (file: FileItemData) => Promise<boolean>;
  confirmShare: (
    file: FileItemData,
    webIds: string[],
    accessLevel: AccessLevel,
  ) => Promise<ShareOperationResult | null>;
}

export function useFileOperations({
  onRefresh,
  onAfterDelete,
  dialogHandlers,
}: UseFileOperationsOptions): UseFileOperationsResult {
  const fetchFn = useSolidFetch();
  const { session } = useSolidAuth();
  const [isDeleting, setIsDeleting] = useState(false);

  const copyFile = useCallback(
    async (file: FileItemData) => {
      if (!file || file.type === "folder") {
        return;
      }

      const result = await runWithToast(
        `Copying "${file.name}"...`,
        async () => {
          await copyFileResource(file, fetchFn);
        },
        {
          successMessage: `Copied "${file.name}"`,
          errorFallback: "Failed to copy resource",
          errorPrefix: "Failed to copy",
        },
      );

      if (result !== null) {
        onRefresh();
      }
    },
    [onRefresh, fetchFn],
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
  }, [fetchFn]);

  /** Deletes a resource; returns true on success so callers can close dialogs. */
  const confirmDelete = useCallback(
    async (file: FileItemData): Promise<boolean> => {
      setIsDeleting(true);

      const result = await runWithToast(
        `Deleting "${file.name}"...`,
        async () => {
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
        return false;
      }

      onAfterDelete?.(file.id);
      setTimeout(() => {
        onRefresh();
      }, 1000);
      return true;
    },
    [onAfterDelete, onRefresh, fetchFn],
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

          await shareResource(resourceUrl, webIds, accessLevel, fetchFn, session.webId);

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
    [fetchFn, session.webId],
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
        case "newFolder":
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
