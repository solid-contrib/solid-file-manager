"use client";

import { useCallback, useMemo, useState } from "react";
import type { FileItemData } from "../../FileItem";
import type { FileOperationDialogHandlers } from "./useFileOperations";

/** Open/close state and targets for file-manager dialogs and upload triggers. */
export interface UseFileDialogsResult {
  showNewFolderDialog: boolean;
  closeNewFolderDialog: () => void;
  fileUploadTrigger: number;
  folderUploadTrigger: number;
  showRenameDialog: boolean;
  fileToRename: FileItemData | null;
  closeRenameDialog: () => void;
  showPreviewModal: boolean;
  fileToPreview: FileItemData | null;
  closePreviewModal: () => void;
  showMoveDialog: boolean;
  fileToMove: FileItemData | null;
  closeMoveDialog: () => void;
  showDeleteDialog: boolean;
  fileToDelete: FileItemData | null;
  closeDeleteDialog: () => void;
  showShareDialog: boolean;
  fileToShare: FileItemData | null;
  closeShareDialog: () => void;
  showShareSuccessModal: boolean;
  sharedResourceUrl: string;
  sharedResourceName: string;
  closeShareSuccessModal: () => void;
  openShareSuccess: (resourceUrl: string, resourceName: string) => void;
  dialogHandlers: FileOperationDialogHandlers;
}

/** Owns dialog visibility and the target file for each modal. */
export function useFileDialogs(): UseFileDialogsResult {
  const [showNewFolderDialog, setShowNewFolderDialog] = useState(false);
  const [fileUploadTrigger, setFileUploadTrigger] = useState(0);
  const [folderUploadTrigger, setFolderUploadTrigger] = useState(0);

  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [fileToRename, setFileToRename] = useState<FileItemData | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [fileToPreview, setFileToPreview] = useState<FileItemData | null>(null);
  const [showMoveDialog, setShowMoveDialog] = useState(false);
  const [fileToMove, setFileToMove] = useState<FileItemData | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<FileItemData | null>(null);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [fileToShare, setFileToShare] = useState<FileItemData | null>(null);
  const [showShareSuccessModal, setShowShareSuccessModal] = useState(false);
  const [sharedResourceUrl, setSharedResourceUrl] = useState("");
  const [sharedResourceName, setSharedResourceName] = useState("");

  const closeNewFolderDialog = useCallback(() => {
    setShowNewFolderDialog(false);
  }, []);

  const closeRenameDialog = useCallback(() => {
    setShowRenameDialog(false);
    setFileToRename(null);
  }, []);

  const closePreviewModal = useCallback(() => {
    setShowPreviewModal(false);
    setFileToPreview(null);
  }, []);

  const closeMoveDialog = useCallback(() => {
    setShowMoveDialog(false);
    setFileToMove(null);
  }, []);

  const closeDeleteDialog = useCallback(() => {
    setShowDeleteDialog(false);
    setFileToDelete(null);
  }, []);

  const closeShareDialog = useCallback(() => {
    setShowShareDialog(false);
    setFileToShare(null);
  }, []);

  const closeShareSuccessModal = useCallback(() => {
    setShowShareSuccessModal(false);
  }, []);

  const openShareSuccess = useCallback(
    (resourceUrl: string, resourceName: string) => {
      setSharedResourceUrl(resourceUrl);
      setSharedResourceName(resourceName);
      setShowShareSuccessModal(true);
    },
    [],
  );

  const dialogHandlers: FileOperationDialogHandlers = useMemo(
    () => ({
      openRenameDialog: (file) => {
        setFileToRename(file);
        setShowRenameDialog(true);
      },
      openPreviewDialog: (file) => {
        setFileToPreview(file);
        setShowPreviewModal(true);
      },
      openMoveDialog: (file) => {
        setFileToMove(file);
        setShowMoveDialog(true);
      },
      openDeleteDialog: (file) => {
        setFileToDelete(file);
        setShowDeleteDialog(true);
      },
      openShareDialog: (file) => {
        setFileToShare(file);
        setShowShareDialog(true);
      },
      openNewFolderDialog: () => setShowNewFolderDialog(true),
      triggerFileUpload: () => setFileUploadTrigger((prev) => prev + 1),
      triggerFolderUpload: () => setFolderUploadTrigger((prev) => prev + 1),
    }),
    [],
  );

  return {
    showNewFolderDialog,
    closeNewFolderDialog,
    fileUploadTrigger,
    folderUploadTrigger,
    showRenameDialog,
    fileToRename,
    closeRenameDialog,
    showPreviewModal,
    fileToPreview,
    closePreviewModal,
    showMoveDialog,
    fileToMove,
    closeMoveDialog,
    showDeleteDialog,
    fileToDelete,
    closeDeleteDialog,
    showShareDialog,
    fileToShare,
    closeShareDialog,
    showShareSuccessModal,
    sharedResourceUrl,
    sharedResourceName,
    closeShareSuccessModal,
    openShareSuccess,
    dialogHandlers,
  };
}
