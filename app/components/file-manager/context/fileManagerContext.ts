"use client";

import { createContext, useContext, type Context } from "react";
import type { FileItemData } from "../../FileItem";
import type { AccessLevel } from "../../ShareDialog";
import type { SolidStorage } from "@/app/lib/hooks";
import type { FileAction } from "../types/fileActions";
import type { ShareOperationResult } from "../hooks/useFileOperations";
import type { UseFileDialogsResult } from "../hooks/useFileDialogs";
import type { BreadcrumbItem } from "@/app/lib/helpers";

/** Navigation slice */
export interface FileManagerNavigationContextValue {
  storages: SolidStorage[];
  selectedStorageId: string | null;
  currentPath: string;
  setCurrentPath: (path: string) => void;
  containerUrlToBrowse: string | null;
  breadcrumbItems: BreadcrumbItem[];
  navigateToBreadcrumb: (path: string) => void;
  navigateToFolder: (folderUrl: string) => void;
  navigateToFile: (file: FileItemData) => void;
  updateUrl: (url: string | null, addToHistory?: boolean) => void;
}

/** Browse slice */
export interface FileManagerBrowseContextValue {
  displayFiles: FileItemData[];
  isLoadingFiles: boolean;
  browseError: Error | null;
  availableFolders: FileItemData[];
  getCurrentLocationUrl: () => string;
  refresh: () => void;
  triggerDelayedRefresh: () => void;
}

/** Selection slice */
export interface FileManagerSelectionContextValue {
  selectedFileIds: string[];
  selectFile: (file: FileItemData) => void;
  clearSelection: () => void;
  removeFromSelection: (fileId: string) => void;
}

/** Dialog slice */
export type FileManagerDialogsContextValue = UseFileDialogsResult;

/** Actions slice */
export interface FileManagerActionsContextValue {
  dispatchFileAction: (action: FileAction) => void;
  confirmDelete: (file: FileItemData) => Promise<boolean>;
  confirmShare: (
    file: FileItemData,
    webIds: string[],
    accessLevel: AccessLevel,
  ) => Promise<ShareOperationResult | null>;
  isDeleting: boolean;
}

export const FileManagerNavigationContext =
  createContext<FileManagerNavigationContextValue | null>(null);

export const FileManagerBrowseContext =
  createContext<FileManagerBrowseContextValue | null>(null);

export const FileManagerSelectionContext =
  createContext<FileManagerSelectionContextValue | null>(null);

export const FileManagerActionsContext =
  createContext<FileManagerActionsContextValue | null>(null);

export const FileManagerDialogsContext =
  createContext<FileManagerDialogsContextValue | null>(null);

function useRequiredContext<T>(
  context: Context<T | null>,
  hookName: string,
): T {
  const value = useContext(context);
  if (!value) {
    throw new Error(`${hookName} must be used within FileManagerProvider`);
  }
  return value;
}

export function useFileManagerNavigation(): FileManagerNavigationContextValue {
  return useRequiredContext(
    FileManagerNavigationContext,
    "useFileManagerNavigation",
  );
}

export function useFileManagerBrowse(): FileManagerBrowseContextValue {
  return useRequiredContext(FileManagerBrowseContext, "useFileManagerBrowse");
}

export function useFileManagerSelection(): FileManagerSelectionContextValue {
  return useRequiredContext(
    FileManagerSelectionContext,
    "useFileManagerSelection",
  );
}

export function useFileManagerActions(): FileManagerActionsContextValue {
  return useRequiredContext(FileManagerActionsContext, "useFileManagerActions");
}

export function useFileManagerDialogs(): FileManagerDialogsContextValue {
  return useRequiredContext(FileManagerDialogsContext, "useFileManagerDialogs");
}
