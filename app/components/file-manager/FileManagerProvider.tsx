"use client";

import { useCallback, useMemo, type ReactNode } from "react";
import type { FileItemData } from "../FileItem";
import type { SolidStorage } from "@/app/lib/hooks";
import {
    FileManagerActionsContext,
    FileManagerBrowseContext,
    FileManagerNavigationContext,
    type FileManagerActionsContextValue,
    type FileManagerBrowseContextValue,
    type FileManagerNavigationContextValue,
} from "./context/fileManagerContext";
import { useFileOperations, type FileOperationDialogHandlers } from "./hooks/useFileOperations";
import { useFileManagerNavigation } from "./hooks/useFileManagerNavigation";
import { useContainerBrowse } from "./hooks/useContainerBrowse";

export interface FileManagerProviderProps {
    children: ReactNode;
    storages: SolidStorage[];
    dialogHandlers: FileOperationDialogHandlers;
    onClearSelection?: () => void;
    onAfterDelete?: (fileId: string) => void;
    onOpenFile?: (file: FileItemData) => void;
    onFolderNavigated?: () => void;
}

/** Feature-scoped provider for the file manager */
export default function FileManagerProvider({
    children,
    storages,
    dialogHandlers,
    onClearSelection,
    onAfterDelete,
    onOpenFile,
    onFolderNavigated,
}: FileManagerProviderProps) {
    const navigation = useFileManagerNavigation({
        storages,
        onClearSelection,
        onOpenFile,
        onFolderNavigated,
    });

    const browse = useContainerBrowse({
        storages,
        selectedStorageId: navigation.selectedStorageId,
        currentPath: navigation.currentPath,
        containerUrlToBrowse: navigation.containerUrlToBrowse,
    });

    const {
        isDeleting,
        dispatchFileAction,
        confirmDelete,
        confirmShare,
    } = useFileOperations({
        onRefresh: browse.refresh,
        onAfterDelete,
        dialogHandlers
    });

    const navigationValue: FileManagerNavigationContextValue = useMemo(
        () => ({
            storages,
            selectedStorageId: navigation.selectedStorageId,
            currentPath: navigation.currentPath,
            containerUrlToBrowse: navigation.containerUrlToBrowse,
            breadcrumbItems: navigation.breadcrumbItems,
            navigateToBreadcrumb: navigation.navigateToBreadcrumb,
            navigateToFolder: navigation.navigateToFolder,
            navigateToFile: navigation.navigateToFile,
            updateUrl: navigation.updateUrl,
        }),
        [navigation, storages],
    );

    const browseValue: FileManagerBrowseContextValue = useMemo(
        () => ({
            displayFiles: browse.displayFiles,
            isLoadingFiles: browse.isLoadingFiles,
            browseError: browse.browseError,
            availableFolders: browse.availableFolders,
            getCurrentLocationUrl: browse.getCurrentLocationUrl,
            refresh: browse.refresh,
            triggerDelayedRefresh: browse.triggerDelayedRefresh,
        }),
        [browse],
    );

    const actionsValue: FileManagerActionsContextValue = useMemo(
        () => ({
            isDeleting,
            dispatchFileAction,
            confirmDelete,
            confirmShare,
        }),
        [isDeleting, dispatchFileAction, confirmDelete, confirmShare],
    );

    return (
        <FileManagerNavigationContext.Provider value={navigationValue}>
            <FileManagerBrowseContext.Provider value={browseValue}>
                <FileManagerActionsContext.Provider value={actionsValue}>
                    {children}
                </FileManagerActionsContext.Provider>
            </FileManagerBrowseContext.Provider>
        </FileManagerNavigationContext.Provider>
    );
}