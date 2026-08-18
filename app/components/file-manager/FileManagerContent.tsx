"use client";

import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import {
    FolderPlusIcon,
    ArrowUpTrayIcon,
    PencilIcon,
    ArrowDownTrayIcon,
    DocumentDuplicateIcon,
    ArrowRightCircleIcon,
    TrashIcon,
    EyeIcon,
    ShareIcon,
} from "@heroicons/react/24/outline";
import Header from "../Header";
import Sidebar from "../Sidebar";
import Breadcrumb from "../Breadcrumb";
import FileList from "../FileList";
import NewFolderDialog from "../NewFolderDialog";
import RenameDialog from "../RenameDialog";
import PreviewModal from "../PreviewModal";
import MoveDialog from "../MoveDialog";
import DeleteConfirmDialog from "../DeleteConfirmDialog";
import ShareDialog, { type AccessLevel } from "../ShareDialog";
import ShareSuccessModal from "../ShareSuccessModal";
import FileUploadHandler from "../FileUploadHandler";
import ContextMenu, { type ContextMenuAction } from "../ContextMenu";
import type { FileItemData } from "../FileItem";
import LoadingSpinner from "../shared/LoadingSpinner";
import ErrorDisplay from "../shared/ErrorDisplay";
import {
    getAuthenticatedSession,
    uploadFilesToContainer,
    uploadFolderFilesToContainer,
    processDragDropItems,
    hasFiles as hasFilesInDrag,
    isUnsupportedFolderDrag,
} from "@/app/lib/helpers";
import { isDialog } from "./types/fileActions";
import { useFileManagerNavigation, useFileManagerBrowse, useFileManagerActions, useFileManagerSelection, useFileManagerDialogs } from "./context/fileManagerContext";

type ContextMenuState =
    | { type: "new"; position: { x: number; y: number } }
    | { type: "file"; position: { x: number; y: number }; file: FileItemData };

/**
 * Main file-manager UI. Must render under FileManagerProvider.
 * Reads nav/browse/selection/dialogs/actions from context; keeps
 * sidebar, drag-drop, and context menu as local UI state.
 */
export default function FileManagerContent() {
    // Context (owned by provider hooks)
    const {
        storages,
        selectedStorageId,
        currentPath,
        containerUrlToBrowse,
        breadcrumbItems,
        navigateToBreadcrumb,
        navigateToFolder,
        navigateToFile,
        updateUrl,
        setCurrentPath,
    } = useFileManagerNavigation();

    const {
        displayFiles,
        isLoadingFiles,
        browseError,
        availableFolders,
        getCurrentLocationUrl,
        refresh,
        triggerDelayedRefresh,
        invalidateContainers,
    } = useFileManagerBrowse();

    const {
        dispatchFileAction,
        confirmDelete,
        confirmShare,
        isDeleting,
    } = useFileManagerActions();

    const { selectedFileIds, selectFile } = useFileManagerSelection();

    const {
        activeDialog,
        closeDialog,
        fileUploadTrigger,
        folderUploadTrigger,
        openShareSuccess,
        dialogHandlers,
    } = useFileManagerDialogs();

    // UI-local states
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [isDragActive, setIsDragActive] = useState(false);
    const dragCounterRef = useRef(0);
    const [contextMenuState, setContextMenuState] = useState<ContextMenuState | null>(null);

    const closeContextMenu = () => setContextMenuState(null);

    // Close context menu on outside click
    useEffect(() => {
        if (!contextMenuState) return;

        const handleClick = () => setContextMenuState(null);
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") setContextMenuState(null);
        };

        document.addEventListener("click", handleClick);
        document.addEventListener("keydown", handleKeyDown);
        return () => {
            document.removeEventListener("click", handleClick);
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [contextMenuState]);

    /** Require a selected container before create/upload actions. */
    const ensureStorageSelected = () => {
        if (!containerUrlToBrowse) {
            toast.error("Please select a storage first.");
            return false;
        }
        return true;
    };

    // Dialog open helpers (also used by provider via the parent wiring)
    const handleBlankContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        setContextMenuState({
            type: "new",
            position: { x: e.clientX, y: e.clientY },
        });
    };

    const handleFileContextMenu = (file: FileItemData, e: React.MouseEvent) => {
        e.preventDefault();
        setContextMenuState({
            type: "file",
            file,
            position: { x: e.clientX, y: e.clientY },
        });
    };

    const handleFileSelect = (file: FileItemData) => {
        selectFile(file);
    };

    const handleRenamed = (newUrl: string) => {
        if (isDialog(activeDialog, "rename") && currentPath === activeDialog.file.url) {
            setCurrentPath(newUrl);
            updateUrl(newUrl, false);
        }
        refresh();
    };

    const handleDeleteConfirm = async () => {
        if (!isDialog(activeDialog, "delete")) return;
        const deleted = await confirmDelete(activeDialog.file);
        if (deleted) {
            closeDialog();
        }
    };

    const handleShareConfirm = async (webIds: string[], accessLevel: AccessLevel) => {
        if (!isDialog(activeDialog, "share")) return;
        const result = await confirmShare(activeDialog.file, webIds, accessLevel);
        if (!result) return;

        openShareSuccess(result.resourceUrl, result.resourceName);
    };

    // Drag & drop upload
    const handleDragEnter = (e: React.DragEvent<HTMLElement>) => {
        if (!hasFilesInDrag(e)) return;
        e.preventDefault();
        dragCounterRef.current += 1;
        setIsDragActive(true);
    }

    const handleDragLeave = (e: React.DragEvent<HTMLElement>) => {
        if (!hasFilesInDrag(e)) return;
        e.preventDefault();
        dragCounterRef.current = Math.max(0, dragCounterRef.current - 1);
        if (dragCounterRef.current === 0) setIsDragActive(false);
    };

    const handleDragOver = (e: React.DragEvent<HTMLElement>) => {
        if (!hasFilesInDrag(e)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
    };

    const handleDrop = async (e: React.DragEvent<HTMLElement>) => {
        if (!hasFilesInDrag(e)) return;
        e.preventDefault();
        dragCounterRef.current = 0;
        setIsDragActive(false);

        if (!containerUrlToBrowse) {
            toast.error("Please select a storage first");
            return;
        }
        let fetchFn: typeof fetch;
        try {
            ({ fetch: fetchFn } = getAuthenticatedSession());
        } catch {
            toast.error("Not authenticated");
            return;
        }

        const { singleFiles, folderFiles } = await processDragDropItems(e);

        if (
            singleFiles.length === 0 &&
            folderFiles.length === 0 &&
            isUnsupportedFolderDrag(e)
        ) {
            toast.error("Folder drag-and-drop is not supported in this browser. Please use the 'Folder Upload' button in the menu.")
            return;
        }

        let uploadedSomething = false;

        if (singleFiles.length > 0) {
            try {
                const { uploadedFiles, failedFiles } = await uploadFilesToContainer(singleFiles, containerUrlToBrowse, fetchFn);
                if (uploadedFiles.length > 0) {
                    uploadedSomething = true;
                    toast.success(
                        uploadedFiles.length === 1
                            ? "File uploaded successfully"
                            : `${uploadedFiles.length} files uploaded successfully`,
                    );
                }
                if (failedFiles.length > 0) {
                    toast.error(
                        failedFiles.length === 1
                            ? `Failed to upload "${failedFiles[0]}"`
                            : `Failed to upload ${failedFiles.length} files.`,
                    );
                }
            } catch (error) {
                console.error("Upload error:", error);
                toast.error("Failed to upload files");
            }
        }

        if (folderFiles.length > 0) {
            try {
                const { uploadedFiles, failedFiles } = await uploadFolderFilesToContainer(folderFiles, containerUrlToBrowse, fetchFn);
                if (uploadedFiles.length > 0) {
                    uploadedSomething = true;
                    toast.success(
                        uploadedFiles.length === 1
                            ? "File uploaded successfully"
                            : `${uploadedFiles.length} files uploaded successfully`,
                    );
                }
                if (failedFiles.length > 0) {
                    toast.error(
                        failedFiles.length === 1
                            ? `Failed to upload "${failedFiles[0]}"`
                            : `Failed to upload ${failedFiles.length} files.`,
                    );
                }
            } catch (error) {
                console.error("Upload error:", error);
                toast.error("Failed to upload folder");
            }
        }

        if (uploadedSomething) {
            await new Promise((resolve) => setTimeout(resolve, 300));
            triggerDelayedRefresh();
        }
    };

    const newContextMenuActions: ContextMenuAction[] = [
        {
            label: "New Folder",
            icon: FolderPlusIcon,
            onClick: () => {
                closeContextMenu();
                if (!ensureStorageSelected()) return;
                dialogHandlers.openNewFolderDialog();
            },
        },
        {
            label: "File Upload",
            icon: ArrowUpTrayIcon,
            onClick: () => {
                closeContextMenu();
                if (!ensureStorageSelected()) return;
                dialogHandlers.triggerFileUpload();
            },
        },
        {
            label: "Folder Upload",
            icon: FolderPlusIcon,
            onClick: () => {
                closeContextMenu();
                if (!ensureStorageSelected()) return;
                dialogHandlers.triggerFolderUpload();
            },
        },
    ];

    const getFileContextMenuActions = (file: FileItemData): ContextMenuAction[] => {
        const actions: ContextMenuAction[] = [];

        if (file.type === "file") {
            actions.push({
                label: "Preview",
                icon: EyeIcon,
                onClick: () => {
                    closeContextMenu();
                    dispatchFileAction({ type: "preview", file });
                },
            });
        }

        actions.push(
            {
                label: "Rename",
                icon: PencilIcon,
                onClick: () => {
                    closeContextMenu();
                    dispatchFileAction({ type: "rename", file });
                },
            },
            {
                label: "Download",
                icon: ArrowDownTrayIcon,
                onClick: () => {
                    closeContextMenu();
                    dispatchFileAction({ type: "download", file });
                },
            },
            {
                label: "Copy",
                icon: DocumentDuplicateIcon,
                onClick: () => {
                    closeContextMenu();
                    dispatchFileAction({ type: "copy", file });
                },
            },
            {
                label: "Share",
                icon: ShareIcon,
                onClick: () => {
                    closeContextMenu();
                    dispatchFileAction({ type: "share", file });
                },
            },
        );

        if (file.type === "file") {
            actions.push({
                label: "Move",
                icon: ArrowRightCircleIcon,
                onClick: () => {
                    closeContextMenu();
                    dispatchFileAction({ type: "move", file });
                },
            });
        }

        actions.push({
            label: "Delete",
            icon: TrashIcon,
            onClick: () => {
                closeContextMenu();
                dispatchFileAction({ type: "delete", file });
            },
        });

        return actions;
    };

    // Browse error 
    if (browseError && selectedStorageId) {
        return (
            <ErrorDisplay
                title="Failed to Load Container Contents"
                message={
                    browseError.message ||
                    "Unable to browse the storage container. Please try again."
                }
                onRetry={() => setCurrentPath("/")}
            />
        );
    }

    const isBrowsing = Boolean(selectedStorageId && isLoadingFiles);

    return (
        <div
            className="flex h-screen flex-col overflow-hidden bg-white"
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            <Header
                onMenuClick={() => setSidebarOpen(true)}
                sidebarOpen={sidebarOpen}
            />
            <div className="flex flex-1 overflow-hidden">
                <Sidebar
                    isOpen={sidebarOpen}
                    onClose={() => setSidebarOpen(false)}
                    currentContainerUrl={containerUrlToBrowse}
                    storages={storages}
                    onFolderNavigate={(folderUrl) => {
                        navigateToFolder(folderUrl);
                        setSidebarOpen(false);
                    }}
                    onNewFolderClick={() => {
                        if (!ensureStorageSelected()) return;
                        dialogHandlers.openNewFolderDialog();
                    }}
                    onFileUploadClick={() => {
                        if (!ensureStorageSelected()) return;
                        dialogHandlers.triggerFileUpload();
                    }}
                    onFolderUploadClick={() => {
                        if (!ensureStorageSelected()) return;
                        dialogHandlers.triggerFolderUpload();
                    }}
                />
                <main
                    className="flex flex-1 flex-col overflow-hidden"
                    onContextMenu={handleBlankContextMenu}
                >
                    <div className="shrink-0">
                        <Breadcrumb
                            items={breadcrumbItems}
                            onNavigate={navigateToBreadcrumb}
                        />
                    </div>
                    {isBrowsing ? (
                        <div className="flex flex-1 items-center justify-center">
                            <LoadingSpinner size="md" text="Loading folder contents..." />
                        </div>
                    ) : (
                        <div className="flex-1 min-h-0 overflow-hidden">
                            <FileList
                                files={displayFiles}
                                currentPath={currentPath}
                                onFileSelect={handleFileSelect}
                                onFileDoubleClick={navigateToFile}
                                onFileRename={(file) =>
                                    dispatchFileAction({ type: "rename", file })
                                }
                                onFilePreview={(file) =>
                                    dispatchFileAction({ type: "preview", file })
                                }
                                onFileCopy={(file) =>
                                    dispatchFileAction({ type: "copy", file })
                                }
                                onFileMove={(file) =>
                                    dispatchFileAction({ type: "move", file })
                                }
                                onFileDownload={(file) =>
                                    dispatchFileAction({ type: "download", file })
                                }
                                onFileDelete={(file) =>
                                    dispatchFileAction({ type: "delete", file })
                                }
                                onFileShare={(file) =>
                                    dispatchFileAction({ type: "share", file })
                                }
                                selectedFileIds={selectedFileIds}
                                onFileContextMenu={handleFileContextMenu}
                            />
                        </div>
                    )}
                </main>
            </div>
            <NewFolderDialog
                isOpen={isDialog(activeDialog, "newFolder")}
                onClose={closeDialog}
                currentContainerUrl={containerUrlToBrowse}
                onFolderCreated={triggerDelayedRefresh}
            />
            <RenameDialog
                isOpen={isDialog(activeDialog, "rename")}
                onClose={closeDialog}
                file={isDialog(activeDialog, "rename") ? activeDialog.file : null}
                onRenamed={handleRenamed}
            />
            <PreviewModal
                isOpen={isDialog(activeDialog, "preview")}
                onClose={closeDialog}
                file={isDialog(activeDialog, "preview") ? activeDialog.file : null}
            />
            <MoveDialog
                isOpen={isDialog(activeDialog, "move")}
                onClose={closeDialog}
                file={isDialog(activeDialog, "move") ? activeDialog.file : null}
                availableFolders={availableFolders}
                currentLocationUrl={getCurrentLocationUrl()}
                onMoved={(destinationUrl) => {
                    invalidateContainers([destinationUrl]);
                    refresh(); // invalidates + refreshes current (source) folder
                }}
            />
            <DeleteConfirmDialog
                isOpen={isDialog(activeDialog, "delete")}
                onClose={closeDialog}
                file={isDialog(activeDialog, "delete") ? activeDialog.file : null}
                onConfirm={handleDeleteConfirm}
                isDeleting={isDeleting}
            />
            <ShareDialog
                isOpen={isDialog(activeDialog, "share")}
                onClose={closeDialog}
                file={isDialog(activeDialog, "share") ? activeDialog.file : null}
                onShare={handleShareConfirm}
            />
            <ShareSuccessModal
                isOpen={isDialog(activeDialog, "shareSuccess")}
                onClose={closeDialog}
                resourceUrl={
                    isDialog(activeDialog, "shareSuccess") ? activeDialog.resourceUrl : ""
                }
                resourceName={
                    isDialog(activeDialog, "shareSuccess") ? activeDialog.resourceName : ""
                }
                onOpenInApp={(url) => updateUrl(url, true)}
            />
            {isDragActive && (
                <div
                    className="pointer-events-none fixed inset-0 z-40 flex flex-col items-center justify-center bg-purple-500/10"
                    role="status"
                    aria-live="polite"
                >
                    <div className="rounded-2xl border border-purple-400 bg-white/90 px-8 py-6 text-center shadow-lg">
                        <p className="text-lg font-semibold text-purple-700">
                            Drop files or folders to upload
                        </p>
                        <p className="mt-2 text-sm text-purple-600">
                            They will be uploaded to the current folder
                        </p>
                    </div>
                </div>
            )}
            <FileUploadHandler
                currentContainerUrl={containerUrlToBrowse}
                onUploadComplete={triggerDelayedRefresh}
                triggerUpload={fileUploadTrigger}
                triggerFolderUpload={folderUploadTrigger}
            />
            {contextMenuState && (
                <ContextMenu
                    position={contextMenuState.position}
                    actions={
                        contextMenuState.type === "new"
                            ? newContextMenuActions
                            : getFileContextMenuActions(contextMenuState.file)
                    }
                    onClose={closeContextMenu}
                />
            )}
        </div>
    );
}
