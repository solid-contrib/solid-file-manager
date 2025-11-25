"use client";

import { useState, useEffect } from "react";
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
} from "../lib/helpers";


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
  const [folderUploadTrigger, setFolderUploadTrigger] = useState(0);
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [fileToRename, setFileToRename] = useState<FileItemData | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [fileToPreview, setFileToPreview] = useState<FileItemData | null>(null);
  const [showMoveDialog, setShowMoveDialog] = useState(false);
  const [fileToMove, setFileToMove] = useState<FileItemData | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<FileItemData | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [savedUrl, setSavedUrl] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;

    try {
      const fullUrl = window.location.href;
      const urlObj = new URL(fullUrl);
      let urlParam = urlObj.searchParams.get("url");

      if (urlParam) {
        try {
          urlParam = decodeURIComponent(urlParam);
        } catch (e) {
          // Keep encoded if decode fails
        }
        return urlParam;
      }

      const stored = sessionStorage.getItem("solid-file-manager-url");
      if (stored) {
        return stored;
      }
    } catch (e) {
      // Ignore
    }
    return null;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    const fullUrl = window.location.href;
    const urlObj = new URL(fullUrl);
    let urlParam = urlObj.searchParams.get("url");

    if (urlParam) {
      try {
        urlParam = decodeURIComponent(urlParam);
      } catch (e) {
        // Ignore
      }
      setSavedUrl(urlParam);
      sessionStorage.setItem("solid-file-manager-url", urlParam);
    }
  }, []);

  useEffect(() => {
    if (isLoadingStorages || storages.length === 0) {
      return;
    }
    if (isInitialized) {
      return;
    }

    const restoreFromUrl = () => {
      let urlParam: string | null = savedUrl;

      if (!urlParam && typeof window !== "undefined") {
        const fullUrl = window.location.href;
        const urlObj = new URL(fullUrl);
        urlParam = urlObj.searchParams.get("url");

        if (!urlParam && window.location.search) {
          const urlParams = new URLSearchParams(window.location.search);
          urlParam = urlParams.get("url");
        }
      }

      if (!urlParam) {
        urlParam = searchParams.get("url");
      }

      if (urlParam) {
        try {
          let decodedUrl = urlParam;
          try {
            decodedUrl = decodeURIComponent(urlParam);
          } catch (e) {
            decodedUrl = urlParam;
          }

          const matchingStorage = storages.find((s) => {
            const storageUrl = s.url.endsWith("/") ? s.url : s.url + "/";
            const normalizedDecoded = decodedUrl.endsWith("/") ? decodedUrl : decodedUrl + "/";
            const normalizedStorage = storageUrl.endsWith("/") ? storageUrl : storageUrl + "/";
            return decodedUrl === s.url || decodedUrl === s.url + "/" || normalizedDecoded.startsWith(normalizedStorage);
          });

          if (matchingStorage) {
            setSelectedStorageId(matchingStorage.id);

            if (decodedUrl === matchingStorage.url || decodedUrl === matchingStorage.url + "/") {
              setCurrentPath("/");
            } else {
              setCurrentPath(decodedUrl);
            }

            if (typeof window !== "undefined") {
              const encodedUrl = encodeURIComponent(decodedUrl);
              const params = new URLSearchParams();
              params.set("url", encodedUrl);
              const newUrl = `/?${params.toString()}`;
              router.replace(newUrl, { scroll: false });
            }

            setIsInitialized(true);
            return;
          }
        } catch (e) {
          // Ignore errors
        }
      }

      setIsInitialized(true);
    };

    restoreFromUrl();
  }, [searchParams, storages, isLoadingStorages, isInitialized, savedUrl, router]);

  const updateUrl = (url: string | null) => {
    if (!url || url === "/") {
      if (typeof window !== "undefined") {
        sessionStorage.removeItem("solid-file-manager-url");
        if (window.location.search) {
          router.replace("/", { scroll: false });
        }
      }
      return;
    }

    let urlToEncode = url;
    try {
      urlToEncode = decodeURIComponent(url);
    } catch (e) {
      urlToEncode = url;
    }

    const encodedUrl = encodeURIComponent(urlToEncode);
    const params = new URLSearchParams();
    params.set("url", encodedUrl);
    const newUrl = `/?${params.toString()}`;

    if (typeof window !== "undefined") {
      sessionStorage.setItem("solid-file-manager-url", urlToEncode);
    }

    router.replace(newUrl, { scroll: false });
  };

  const containerUrlToBrowse = selectedStorageId
    ? currentPath === "/"
      ? storages.find((s) => s.id === selectedStorageId)?.url || null
      : currentPath
    : null;

  const { files: browsedFiles, isLoading: isLoadingFiles, error: browseError } = useBrowseStorage(containerUrlToBrowse, refreshKey);


  const handleFolderCreated = () => {
    setRefreshKey((prev) => prev + 1);
  };

  const handleFileUploaded = () => {
    setRefreshKey((prev) => prev + 1);
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
      setShowDeleteDialog(false);
      setFileToDelete(null);
      setRefreshKey((prev) => prev + 1);
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
      <div className="flex h-screen flex-col overflow-hidden bg-white">
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
