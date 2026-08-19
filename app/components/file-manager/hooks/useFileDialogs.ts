"use client";

import { useCallback, useMemo, useState } from "react";
import type { ActiveDialog, FileDialogAction } from "../types/fileActions";
import type { FileOperationDialogHandlers } from "./useFileOperations";

/** Open/close state for file-manager dialogs and upload triggers. */
export interface UseFileDialogsResult {
  activeDialog: ActiveDialog | null;
  closeDialog: () => void;
  fileUploadTrigger: number;
  folderUploadTrigger: number;
  openShareSuccess: (resourceUrl: string, resourceName: string) => void;
  dialogHandlers: FileOperationDialogHandlers;
}

/** Owns which modal is open (at most one) and upload trigger counters. */
export function useFileDialogs(): UseFileDialogsResult {
  const [activeDialog, setActiveDialog] = useState<ActiveDialog | null>(null);
  const [fileUploadTrigger, setFileUploadTrigger] = useState(0);
  const [folderUploadTrigger, setFolderUploadTrigger] = useState(0);

  const closeDialog = useCallback(() => {
    setActiveDialog(null);
  }, []);

  const openShareSuccess = useCallback(
    (resourceUrl: string, resourceName: string) => {
      setActiveDialog({ type: "shareSuccess", resourceUrl, resourceName });
    },
    [],
  );

  const openFileDialog = useCallback((action: FileDialogAction) => {
    setActiveDialog(action);
  }, []);

  const dialogHandlers: FileOperationDialogHandlers = useMemo(
    () => ({
      openRenameDialog: (file) => openFileDialog({ type: "rename", file }),
      openPreviewDialog: (file) => openFileDialog({ type: "preview", file }),
      openMoveDialog: (file) => openFileDialog({ type: "move", file }),
      openDeleteDialog: (file) => openFileDialog({ type: "delete", file }),
      openShareDialog: (file) => openFileDialog({ type: "share", file }),
      openNewFolderDialog: () => setActiveDialog({ type: "newFolder" }),
      triggerFileUpload: () => setFileUploadTrigger((prev) => prev + 1),
      triggerFolderUpload: () => setFolderUploadTrigger((prev) => prev + 1),
    }),
    [openFileDialog],
  );

  return {
    activeDialog,
    closeDialog,
    fileUploadTrigger,
    folderUploadTrigger,
    openShareSuccess,
    dialogHandlers,
  };
}
