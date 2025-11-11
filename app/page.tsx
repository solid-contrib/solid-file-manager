"use client";

import { useState, useEffect } from "react";
import AuthWrapper from "./components/AuthWrapper";
import Header from "./components/Header";
import Sidebar from "./components/Sidebar";
import Breadcrumb from "./components/Breadcrumb";
import FileList from "./components/FileList";
import PermissionsDialog, { Permission } from "./components/PermissionsDialog";
import { FileItemData } from "./components/FileItem";
import { useSolidStorages } from "./lib/hooks";
import LoadingSpinner from "./components/shared/LoadingSpinner";
import ErrorDisplay from "./components/shared/ErrorDisplay";

export default function Home() {
  const { storages, isLoading: isLoadingStorages, error: storagesError } = useSolidStorages();
  
  const [selectedStorageId, setSelectedStorageId] = useState<string | null>(null);
  const [currentPath, setCurrentPath] = useState<string>("/");
  const [selectedFileIds, setSelectedFileIds] = useState<string[]>([]);
  const [files, setFiles] = useState<FileItemData[]>([]);
  const [permissionsDialogOpen, setPermissionsDialogOpen] = useState(false);
  const [selectedFileForPermissions, setSelectedFileForPermissions] =
    useState<FileItemData | null>(null);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  // Sidebar is open by default on desktop, closed on mobile
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Convert storages to FileItemData format for display in FileList
  const storageFiles: FileItemData[] = storages.map((storage) => ({
    id: storage.id,
    name: storage.name,
    type: "folder" as const,
    url: storage.url,
    lastModified: new Date(), // Storages don't have a lastModified date
  }));

  // Combine storage files with actual files
  // If no storage is selected, show storages. If a storage is selected, show files in that storage
  const displayFiles = selectedStorageId ? files : storageFiles;

  // Get selected storage name for breadcrumb
  const selectedStorage = storages.find((s) => s.id === selectedStorageId);
  const breadcrumbItems = [
    { name: "My Solid Storages", path: "/" },
    ...(currentPath !== "/" ? [{ name: currentPath.split("/").pop() || "", path: currentPath }] : []),
  ];

  const handleFileDoubleClick = (file: FileItemData) => {
    if (file.type === "folder") {
      // If it's a storage (not yet selected), select it
      if (!selectedStorageId && storages.some(s => s.id === file.id)) {
        setSelectedStorageId(file.id);
        setCurrentPath("/");
        setSelectedFileIds([]);
        // In real implementation, fetch files for the selected storage
        console.log("Selected storage:", file);
      } else {
        // Navigate into folder
        setCurrentPath(file.url);
        setSelectedFileIds([]);
        // In real implementation, navigate into folder and fetch its contents
      }
    } else {
      // In real implementation, open/preview the file
      console.log("Open file:", file);
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
      // Navigate back to storages view
      setSelectedStorageId(null);
      setCurrentPath("/");
      setSelectedFileIds([]);
    } else {
      setCurrentPath(path);
      setSelectedFileIds([]);
      // In real implementation, navigate to the path and fetch files
    }
  };

  const handleShareClickForFile = (file: FileItemData) => {
    setSelectedFileForPermissions(file);
    setPermissionsDialogOpen(true);
    // In real implementation, fetch permissions for the file
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
    // In real implementation, add permission via ACP
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
    // In real implementation, remove permission via ACP
    setPermissions((prev) => prev.filter((p) => p.id !== permissionId));
  };

  const handleUpdatePermission = (permissionId: string, role: "viewer" | "editor") => {
    // In real implementation, update permission via ACP
    setPermissions((prev) =>
      prev.map((p) => (p.id === permissionId ? { ...p, role } : p))
    );
  };

  const handleShareClick = () => {
    if (selectedFileIds.length === 1) {
      const file = displayFiles.find((f) => f.id === selectedFileIds[0]);
      if (file) {
        handleShareClickForFile(file);
      }
    } else if (selectedFileIds.length > 1) {
      // Handle multiple file sharing (could show a different dialog)
      console.log("Share multiple files:", selectedFileIds);
    }
  };

  console.log("storages", storages);

  // Show loading state while fetching storages
  if (isLoadingStorages) {
    return (
      <AuthWrapper>
        <div className="flex min-h-screen items-center justify-center bg-white">
          <LoadingSpinner size="md" text="Loading your Solid storages..." />
        </div>
      </AuthWrapper>
    );
  }

  // Show error state if storage fetch failed
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

  // Show empty state if no storages found
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
          selectedFileCount={selectedFileIds.length}
          onShareClick={selectedFileIds.length > 0 ? handleShareClick : undefined}
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
            <FileList
              files={displayFiles}
              currentPath={currentPath}
              onFileSelect={handleFileSelect}
              onFileDoubleClick={handleFileDoubleClick}
              selectedFileIds={selectedFileIds}
            />
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
