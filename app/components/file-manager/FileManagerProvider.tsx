"use client";

import type { ReactNode } from "react";
import type { SolidStorage } from "@/app/lib/hooks";
import { FileManagerActionsContext, type FileManagerActionsContextValue } from "./context/fileManagerContext";
import { useFileOperations, type FileOperationDialogHandlers } from "./hooks/useFileOperations";

export interface FileManagerProviderProps {
    children: ReactNode;
    storages: SolidStorage[];
    onRefresh: () => void;
    onAfterDelete?: (fileId: string) => void;
    dialogHandlers: FileOperationDialogHandlers;
}

/** Feature-scoped provider for the file manager */
export default function FileManagerProvider({
    children,
    storages: _storages,
    onRefresh,
    onAfterDelete,
    dialogHandlers,
}: FileManagerProviderProps) {
    const {
        isDeleting,
        dispatchFileAction,
        confirmDelete,
        confirmShare,
    } = useFileOperations({
        onRefresh,
        onAfterDelete,
        dialogHandlers
    });

    const actionsValue: FileManagerActionsContextValue = {
        isDeleting,
        dispatchFileAction,
        confirmDelete,
        confirmShare,
    }

    return (
        <FileManagerActionsContext.Provider value={actionsValue}>
            {children}
        </FileManagerActionsContext.Provider>
    )
}