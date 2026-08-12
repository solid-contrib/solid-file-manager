"use client";

import { useMemo, type ReactNode } from "react";
import type { SolidStorage } from "@/app/lib/hooks";
import {
    FileManagerActionsContext,
    FileManagerBrowseContext,
    FileManagerDialogsContext,
    FileManagerNavigationContext,
    FileManagerSelectionContext,
    type FileManagerActionsContextValue,
    type FileManagerBrowseContextValue,
    type FileManagerNavigationContextValue,
    type FileManagerSelectionContextValue,
} from "./context/fileManagerContext";
import { useFileOperations } from "./hooks/useFileOperations";
import { useFileManagerNavigation } from "./hooks/useFileManagerNavigation";
import { useContainerBrowse } from "./hooks/useContainerBrowse";
import { useFileDialogs } from "./hooks/useFileDialogs";
import { useFileSelection } from "./hooks/useFileSelection";

export interface FileManagerProviderProps {
    children: ReactNode;
    storages: SolidStorage[];
}

/** Feature-scoped provider for the file manager. */
export default function FileManagerProvider({
    children,
    storages,
}: FileManagerProviderProps) {
    const dialogs = useFileDialogs();
    const selection = useFileSelection();

    const navigation = useFileManagerNavigation({
        storages,
        onClearSelection: selection.clearSelection,
        onOpenFile: dialogs.dialogHandlers.openPreviewDialog,
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
        onAfterDelete: selection.removeFromSelection,
        dialogHandlers: dialogs.dialogHandlers,
    });

    const navigationValue: FileManagerNavigationContextValue = useMemo(
        () => ({
            storages,
            selectedStorageId: navigation.selectedStorageId,
            currentPath: navigation.currentPath,
            setCurrentPath: navigation.setCurrentPath,
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

    const selectionValue: FileManagerSelectionContextValue = useMemo(
        () => ({
            selectedFileIds: selection.selectedFileIds,
            selectFile: selection.selectFile,
            clearSelection: selection.clearSelection,
            removeFromSelection: selection.removeFromSelection,
        }),
        [selection],
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
                <FileManagerSelectionContext.Provider value={selectionValue}>
                    <FileManagerDialogsContext.Provider value={dialogs}>
                        <FileManagerActionsContext.Provider value={actionsValue}>
                            {children}
                        </FileManagerActionsContext.Provider>
                    </FileManagerDialogsContext.Provider>
                </FileManagerSelectionContext.Provider>
            </FileManagerBrowseContext.Provider>
        </FileManagerNavigationContext.Provider>
    );
}
