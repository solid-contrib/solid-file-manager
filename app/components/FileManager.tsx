"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import toast from "react-hot-toast";
import { useSearchParams, useRouter } from "next/navigation";
import AuthWrapper from "./AuthWrapper";
import Header from "./Header";
import Sidebar from "./Sidebar";
import Breadcrumb from "./Breadcrumb";
import FileList from "./FileList";
import PermissionsDialog, { Permission } from "./PermissionsDialog";
import NewFolderDialog from "./NewFolderDialog";
import RenameDialog from "./RenameDialog";
import PreviewModal from "./PreviewModal";
import MoveDialog from "./MoveDialog";
import DeleteConfirmDialog from "./DeleteConfirmDialog";
import FileUploadHandler from "./FileUploadHandler";
import { FileItemData } from "./FileItem";
import LoadingSpinner from "./shared/LoadingSpinner";
import ErrorDisplay from "./shared/ErrorDisplay";
import { useSolidStorages, useBrowseStorage } from "../lib/hooks";
import {
  buildBreadcrumbItems,
  getAuthenticatedSession,
  copyFileResource,
  copyFolderResource,
  downloadFile,
  downloadFolderAsZip,
  deleteFileResource,
  deleteFolderResource,
  uploadFilesToContainer,
  uploadFolderFilesToContainer,
  FolderUploadFile,
  processDragDropItems,
  hasFiles as hasFilesInDrag,
  isUnsupportedFolderDrag,
} from "../lib/helpers";
import {
  getUrlFromSearchParams,
  getUrlFromStorage,
  saveUrlToStorage,
  removeUrlFromStorage,
  safeEncodeUrl,
} from "../lib/helpers/urlStateUtils";

export default function FileManager() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { storages, isLoading: isLoadingStorages, error: storagesError } = useSolidStorages();
  const [selectedStorageId, setSelectedStorageId] = useState<string | null>(null);
  const [currentPath, setCurrentPath] = useState<string>("/");
  const [selectedFileIds, setSelectedFileIds] = useState<string[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [permissionsDialogOpen, setPermissionsDialogOpen] = useState(false);
  const [selectedFileForPermissions, setSelectedFileForPermissions] =
    useState<FileItemData | null>(null);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showNewFolderDialog, setShowNewFolderDialog] = useState(false);
  const [fileUploadTrigger, setFileUploadTrigger] = useState(0);
  const [isDragActive, setIsDragActive] = useState(false);
  const dragCounterRef = useRef(0);
  const [folderUploadTrigger, setFolderUploadTrigger] = useState(0);
  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [fileToRename, setFileToRename] = useState<FileItemData | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [fileToPreview, setFileToPreview] = useState<FileItemData | null>(null);
  const [showMoveDialog, setShowMoveDialog] = useState(false);
  const [fileToMove, setFileToMove] = useState<FileItemData | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<FileItemData | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (isLoadingStorages || storages.length === 0 || isInitialized) {
      return;
    }

    // Get URL from search params first, then fallback to sessionStorage
    const urlParam = getUrlFromSearchParams() || getUrlFromStorage();

    if (!urlParam) {
      setIsInitialized(true);
      return;
    }

    saveUrlToStorage(urlParam);

    try {
      // Find which storage this URL belongs to
      const matchingStorage = storages.find((s) => urlParam === s.url || urlParam.startsWith(s.url));

      if (matchingStorage) {
        setSelectedStorageId(matchingStorage.id);
        setCurrentPath(urlParam === matchingStorage.url ? "/" : urlParam);

        if (typeof window !== "undefined") {
          const params = new URLSearchParams();
          params.set("url", safeEncodeUrl(urlParam));
          router.replace(`/?${params.toString()}`, { scroll: false });
        }

        setIsInitialized(true);
        return;
      }
    } catch (e) {
      console.error("Failed to set initial URL:", e);
    }

    setIsInitialized(true);
  }, [searchParams, storages, isLoadingStorages, isInitialized, router]);

  useEffect(() => {
    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
    };
  }, []);

  const updateUrl = (url: string | null) => {
    if (!url || url === "/") {
      removeUrlFromStorage();
      if (typeof window !== "undefined" && window.location.search) {
        router.replace("/", { scroll: false });
      }
      return;
    }

    const params = new URLSearchParams();
    params.set("url", safeEncodeUrl(url));
    saveUrlToStorage(url);
    router.replace(`/?${params.toString()}`, { scroll: false });
  };

  const containerUrlToBrowse = selectedStorageId
    ? currentPath === "/"
      ? storages.find((s) => s.id === selectedStorageId)?.url || null
      : currentPath
    : null;

  const { files: browsedFiles, isLoading: isLoadingFiles, error: browseError } = useBrowseStorage(containerUrlToBrowse, refreshKey);

  const triggerContainerRefresh = useCallback(() => {
    const currentContainerUrl = selectedStorageId
      ? currentPath === "/"
        ? storages.find((s) => s.id === selectedStorageId)?.url || null
        : currentPath
      : null;

    if (!currentContainerUrl) {
      return;
    }

    // Clear any existing timeout
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
    }

    // Single refresh after a delay to give server time to process
    refreshTimeoutRef.current = setTimeout(() => {
      setRefreshKey((prev) => prev + 1);
      refreshTimeoutRef.current = null;
    }, 1000);
  }, [selectedStorageId, currentPath, storages]);

  const handleFolderCreated = () => {
    triggerContainerRefresh();
  };

  const handleFileUploaded = () => {
    triggerContainerRefresh();
  };

  const handleRename = (file: FileItemData) => {
    setFileToRename(file);
    setShowRenameDialog(true);
  };

  const handleRenamed = (newUrl: string) => {

    if (fileToRename && currentPath === fileToRename.url) {
      setCurrentPath(newUrl);
      updateUrl(newUrl);
    }
    // Trigger refresh to update file list immediately
    setRefreshKey((prev) => prev + 1);
  };

  const handleCopy = async (file: FileItemData) => {
    if (!file) {
      return;
    }

    const toastId = toast.loading(`Copying "${file.name}"...`);
    try {
      const { fetch: fetchFn } = getAuthenticatedSession();
      if (file.type === "folder") {
        await copyFolderResource(file, fetchFn);
      } else {
        await copyFileResource(file, fetchFn);
      }
      toast.success(`Copied "${file.name}"`, { id: toastId });
      setRefreshKey((prev) => prev + 1);
    } catch (error) {
      console.error("Failed to copy resource:", error);
      toast.error(
        error instanceof Error ? `Failed to copy: ${error.message}` : "Failed to copy resource",
        { id: toastId }
      );
    }
  };

  const handlePreview = (file: FileItemData) => {
    setFileToPreview(file);
    setShowPreviewModal(true);
  };

  const handleMove = (file: FileItemData) => {
    setFileToMove(file);
    setShowMoveDialog(true);
  };

  const handleMoved = () => {
    setRefreshKey((prev) => prev + 1);
  };

  const handleDelete = (file: FileItemData) => {
    setFileToDelete(file);
    setShowDeleteDialog(true);
  };

  const handleDeleteConfirm = async () => {
    if (!fileToDelete) {
      return;
    }

    setIsDeleting(true);
    const toastId = toast.loading(
      `Deleting "${fileToDelete.name}"...`
    );

    try {
      const { fetch: fetchFn } = getAuthenticatedSession();

      if (fileToDelete.type === "folder") {
        await deleteFolderResource(fileToDelete.url, fetchFn);
      } else {
        await deleteFileResource(fileToDelete.url, fetchFn);
      }

      toast.success(`Deleted "${fileToDelete.name}"`, { id: toastId });
      
      // Clear selected files if the deleted file was selected
      setSelectedFileIds((prev) => prev.filter((id) => id !== fileToDelete.id));
      
      setShowDeleteDialog(false);
      setFileToDelete(null);
      
      // Wait a bit for server to process deletion, then trigger single refresh
      setTimeout(() => {
        setRefreshKey((prev) => prev + 1);
      }, 1000);
    } catch (error) {
      console.error("Failed to delete resource:", error);
      toast.error(
        error instanceof Error
          ? `Failed to delete: ${error.message}`
          : "Failed to delete resource",
        { id: toastId }
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDownload = async (file: FileItemData) => {
    if (!file) {
      return;
    }

    const toastId = toast.loading(
      file.type === "folder" ? `Preparing "${file.name}" for download...` : `Downloading "${file.name}"...`
    );

    try {
      const { fetch: fetchFn } = getAuthenticatedSession();

      if (file.type === "folder") {
        await downloadFolderAsZip(file.url, file.name, fetchFn);
        toast.success(`Downloaded "${file.name}.zip"`, { id: toastId });
      } else {
        await downloadFile(file.url, file.name, fetchFn);
        toast.success(`Downloaded "${file.name}"`, { id: toastId });
      }
    } catch (error) {
      console.error("Failed to download resource:", error);
      toast.error(
        error instanceof Error
          ? `Failed to download: ${error.message}`
          : "Failed to download resource",
        { id: toastId }
      );
    }
  };

  const handleDragEnter = (event: React.DragEvent<HTMLElement>) => {
    if (!hasFilesInDrag(event)) return;
    event.preventDefault();
    dragCounterRef.current += 1;
    setIsDragActive(true);
  };

  const handleDragLeave = (event: React.DragEvent<HTMLElement>) => {
    if (!hasFilesInDrag(event)) return;
    event.preventDefault();
    dragCounterRef.current = Math.max(0, dragCounterRef.current - 1);
    if (dragCounterRef.current === 0) {
      setIsDragActive(false);
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLElement>) => {
    if (!hasFilesInDrag(event)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  };

  const handleDrop = async (event: React.DragEvent<HTMLElement>) => {
    if (!hasFilesInDrag(event)) return;
    event.preventDefault();
    dragCounterRef.current = 0;
    setIsDragActive(false);

    if (!containerUrlToBrowse) {
      toast.error("Please select a storage first");
      return;
    }

    let fetchFn: typeof fetch;
    try {
      ({ fetch: fetchFn } = getAuthenticatedSession());
    } catch (error) {
      toast.error("Not authenticated");
      return;
    }

    // Process drag-and-drop items (handles both files and folders)
    const { singleFiles, folderFiles } = await processDragDropItems(event);

    // Check for unsupported folder drag (only if no files were processed and File System Access API wasn't used)
    if (singleFiles.length === 0 && folderFiles.length === 0 && isUnsupportedFolderDrag(event)) {
      toast.error(
        "Folder drag-and-drop is not supported in this browser. Please use the 'Folder Upload' button in the menu."
      );
      return;
    }

    let uploadedSomething = false;

    if (singleFiles.length > 0) {
      try {
        const { uploadedFiles, failedFiles } = await uploadFilesToContainer(
          singleFiles,
          containerUrlToBrowse,
          fetchFn
        );

        if (uploadedFiles.length > 0) {
          uploadedSomething = true;
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
      } catch (error) {
        console.error("Upload error:", error);
        toast.error("Failed to upload files");
      }
    }

    if (folderFiles.length > 0) {
      try {
        const { uploadedFiles, failedFiles } = await uploadFolderFilesToContainer(
          folderFiles,
          containerUrlToBrowse,
          fetchFn
        );

        if (uploadedFiles.length > 0) {
          uploadedSomething = true;
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
      } catch (error) {
        console.error("Upload error:", error);
        toast.error("Failed to upload folder");
      }
    }

    if (uploadedSomething) {
      // Wait a bit for the server to process the upload
      await new Promise((resolve) => setTimeout(resolve, 300));
      // Trigger refresh with retry mechanism
      triggerContainerRefresh();
    }
  };

  const storageFiles: FileItemData[] = storages.map((storage) => ({
    id: storage.id,
    name: storage.name,
    type: "folder" as const,
    url: storage.url,
  }));

  const displayFiles = selectedStorageId ? browsedFiles : storageFiles;

  // Get all available folders for move dialog (storages + browsed folders)
  const availableFolders: FileItemData[] = [
    ...storageFiles,
    ...(selectedStorageId ? browsedFiles.filter((f) => f.type === "folder") : []),
  ];

  // Get current location URL for move dialog
  const getCurrentLocationUrl = (): string => {
    if (!selectedStorageId) {
      return "";
    }
    if (currentPath === "/") {
      const storage = storages.find((s) => s.id === selectedStorageId);
      return storage?.url || "";
    }
    return currentPath;
  };

  const selectedStorage = storages.find((s) => s.id === selectedStorageId);
  const breadcrumbItems = buildBreadcrumbItems(
    selectedStorageId,
    selectedStorage?.url,
    selectedStorage?.name,
    currentPath
  );

  const handleFileDoubleClick = (file: FileItemData) => {
    if (file.type === "folder") {
      const isStorage = storages.some(s => s.id === file.id);

      if (!selectedStorageId && isStorage) {
        setSelectedStorageId(file.id);
        setCurrentPath("/");
        setSelectedFileIds([]);
        updateUrl(file.url);
      } else if (selectedStorageId) {
        setCurrentPath(file.url);
        setSelectedFileIds([]);
        updateUrl(file.url);
      }
    } else {
      window.open(file.url, "_blank");
    }
  };

  const handleFileSelect = (file: FileItemData) => {
    setSelectedFileIds((prev) => {
      if (prev.includes(file.id)) {
        return prev.filter((id) => id !== file.id);
      }
      return [...prev, file.id];
    });
  };

  const handleBreadcrumbNavigate = (path: string) => {
    if (path === "/") {
      setSelectedStorageId(null);
      setCurrentPath("/");
      setSelectedFileIds([]);
      updateUrl(null);
    } else {
      const selectedStorage = storages.find((s) => s.id === selectedStorageId);
      if (selectedStorage && path === selectedStorage.url) {
        setCurrentPath("/");
        updateUrl(selectedStorage.url);
      } else {
        setCurrentPath(path);
        updateUrl(path);
      }
      setSelectedFileIds([]);
    }
  };

  const handleShareClickForFile = (file: FileItemData) => {
    setSelectedFileForPermissions(file);
    setPermissionsDialogOpen(true);
    setPermissions([
      {
        id: "1",
        type: "user",
        webId: "https://id.inrupt.com/user",
        name: "You",
        role: "owner",
      },
    ]);
  };

  const handleAddPermission = async (webId: string, role: "viewer" | "editor") => {
    const newPermission: Permission = {
      id: Date.now().toString(),
      type: "user",
      webId,
      name: webId.split("/").pop() || webId,
      role,
    };
    setPermissions((prev) => [...prev, newPermission]);
  };

  const handleRemovePermission = (permissionId: string) => {
    setPermissions((prev) => prev.filter((p) => p.id !== permissionId));
  };

  const handleUpdatePermission = (permissionId: string, role: "viewer" | "editor") => {
    setPermissions((prev) =>
      prev.map((p) => (p.id === permissionId ? { ...p, role } : p))
    );
  };

  if (isLoadingStorages) {
    return (
      <AuthWrapper>
        <div className="flex min-h-screen items-center justify-center bg-white">
          <LoadingSpinner size="md" text="Loading your Solid storages..." />
        </div>
      </AuthWrapper>
    );
  }

  const isBrowsing = selectedStorageId && isLoadingFiles;

  if (storagesError) {
    return (
      <AuthWrapper>
        <ErrorDisplay
          title="Failed to Load Storages"
          message={storagesError.message || "Unable to discover your Solid storage roots. Please try again."}
          onRetry={() => window.location.reload()}
        />
      </AuthWrapper>
    );
  }

  if (browseError && selectedStorageId) {
    return (
      <AuthWrapper>
        <ErrorDisplay
          title="Failed to Load Container Contents"
          message={browseError.message || "Unable to browse the storage container. Please try again."}
          onRetry={() => {
            setCurrentPath("/");
          }}
        />
      </AuthWrapper>
    );
  }

  if (storages.length === 0) {
    return (
      <AuthWrapper>
        <div className="flex min-h-screen items-center justify-center bg-white">
          <div className="text-center">
            <h2 className="mb-2 text-xl font-semibold text-black">No Storages Found</h2>
            <p className="text-gray-600">
              Unable to discover any Solid storage roots from your WebID profile.
            </p>
          </div>
        </div>
      </AuthWrapper>
    );
  }

  return (
    <AuthWrapper>
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
            activeTab="my-storages"
            currentContainerUrl={containerUrlToBrowse}
            onNewFolderClick={() => setShowNewFolderDialog(true)}
            onFileUploadClick={() => setFileUploadTrigger((prev) => prev + 1)}
            onFolderUploadClick={() => setFolderUploadTrigger((prev) => prev + 1)}
          />
          <main className="flex flex-1 flex-col overflow-hidden">
            <div className="flex-shrink-0">
              <Breadcrumb items={breadcrumbItems} onNavigate={handleBreadcrumbNavigate} />
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
                  onFileDoubleClick={handleFileDoubleClick}
                  onFileRename={handleRename}
                  onFilePreview={handlePreview}
                  onFileCopy={handleCopy}
                  onFileMove={handleMove}
                  onFileDownload={handleDownload}
                  onFileDelete={handleDelete}
                  selectedFileIds={selectedFileIds}
                />
              </div>
            )}
          </main>
        </div>
        {selectedFileForPermissions && (
          <PermissionsDialog
            isOpen={permissionsDialogOpen}
            onClose={() => {
              setPermissionsDialogOpen(false);
              setSelectedFileForPermissions(null);
            }}
            fileName={selectedFileForPermissions.name}
            permissions={permissions}
            onAddPermission={handleAddPermission}
            onRemovePermission={handleRemovePermission}
            onUpdatePermission={handleUpdatePermission}
          />
        )}
        <NewFolderDialog
          isOpen={showNewFolderDialog}
          onClose={() => setShowNewFolderDialog(false)}
          currentContainerUrl={containerUrlToBrowse}
          onFolderCreated={handleFolderCreated}
        />
        <RenameDialog
          isOpen={showRenameDialog}
          onClose={() => {
            setShowRenameDialog(false);
            setFileToRename(null);
          }}
          file={fileToRename}
          onRenamed={handleRenamed}
        />
        <PreviewModal
          isOpen={showPreviewModal}
          onClose={() => {
            setShowPreviewModal(false);
            setFileToPreview(null);
          }}
          file={fileToPreview}
        />
        <MoveDialog
          isOpen={showMoveDialog}
          onClose={() => {
            setShowMoveDialog(false);
            setFileToMove(null);
          }}
          file={fileToMove}
          availableFolders={availableFolders}
          currentLocationUrl={getCurrentLocationUrl()}
          onMoved={handleMoved}
        />
        <DeleteConfirmDialog
          isOpen={showDeleteDialog}
          onClose={() => {
            setShowDeleteDialog(false);
            setFileToDelete(null);
          }}
          file={fileToDelete}
          onConfirm={handleDeleteConfirm}
          isDeleting={isDeleting}
        />
        {isDragActive && (
          <div className="pointer-events-none fixed inset-0 z-40 flex flex-col items-center justify-center bg-purple-500/10">
            <div className="rounded-2xl border border-purple-400 bg-white/90 px-8 py-6 text-center shadow-lg">
              <p className="text-lg font-semibold text-purple-700">Drop files or folders to upload</p>
              <p className="text-sm text-purple-600 mt-2">
                They will be uploaded to the current folder
              </p>
            </div>
          </div>
        )}
        <FileUploadHandler
          currentContainerUrl={containerUrlToBrowse}
          onUploadComplete={handleFileUploaded}
          triggerUpload={fileUploadTrigger}
          triggerFolderUpload={folderUploadTrigger}
        />
      </div>
    </AuthWrapper>
  );
}
