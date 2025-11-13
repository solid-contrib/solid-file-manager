"use client";

import { useState, useEffect } from "react";
import AuthWrapper from "./components/AuthWrapper";
import Header from "./components/Header";
import Sidebar from "./components/Sidebar";
import Breadcrumb from "./components/Breadcrumb";
import FileList from "./components/FileList";
import PermissionsDialog, { Permission } from "./components/PermissionsDialog";
import { FileItemData } from "./components/FileItem";
import { useSolidStorages, useBrowseStorage } from "./lib/hooks";
import { filterProfileItems, buildBreadcrumbItems } from "./lib/helpers";
import LoadingSpinner from "./components/shared/LoadingSpinner";
import ErrorDisplay from "./components/shared/ErrorDisplay";

export default function Home() {
  const { storages, isLoading: isLoadingStorages, error: storagesError } = useSolidStorages();
  const [selectedStorageId, setSelectedStorageId] = useState<string | null>(null);
  const [currentPath, setCurrentPath] = useState<string>("/");
  const [selectedFileIds, setSelectedFileIds] = useState<string[]>([]);
  
  const containerUrlToBrowse = selectedStorageId
    ? currentPath === "/"
      ? storages.find((s) => s.id === selectedStorageId)?.url || null
      : currentPath
    : null;
  
  const { files: browsedFiles, isLoading: isLoadingFiles, error: browseError } = useBrowseStorage(containerUrlToBrowse);
  const [permissionsDialogOpen, setPermissionsDialogOpen] = useState(false);
  const [selectedFileForPermissions, setSelectedFileForPermissions] =
    useState<FileItemData | null>(null);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const storageFiles: FileItemData[] = filterProfileItems(storages).map((storage) => ({
    id: storage.id,
    name: storage.name,
    type: "folder" as const,
    url: storage.url,
    lastModified: new Date(),
  }));

  const filteredFiles = filterProfileItems(browsedFiles);
  const displayFiles = selectedStorageId ? filteredFiles : storageFiles;

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
      } else if (selectedStorageId) {
        setCurrentPath(file.url);
        setSelectedFileIds([]);
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
    } else {
      const selectedStorage = storages.find((s) => s.id === selectedStorageId);
      if (selectedStorage && path === selectedStorage.url) {
        setCurrentPath("/");
      } else {
        setCurrentPath(path);
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
            // Reset to storage root
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
            />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar
            isOpen={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
            activeTab="my-storages"
          />
          <main className="flex flex-1 flex-col overflow-hidden">
            <Breadcrumb items={breadcrumbItems} onNavigate={handleBreadcrumbNavigate} />
            {isBrowsing ? (
              <div className="flex flex-1 items-center justify-center">
                <LoadingSpinner size="md" text="Loading folder contents..." />
              </div>
            ) : (
              <FileList
                files={displayFiles}
                currentPath={currentPath}
                onFileSelect={handleFileSelect}
                onFileDoubleClick={handleFileDoubleClick}
                selectedFileIds={selectedFileIds}
              />
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
      </div>
    </AuthWrapper>
  );
}
