"use client";

import { useState } from "react";
import AuthWrapper from "./components/AuthWrapper";
import Header from "./components/Header";
import Sidebar from "./components/Sidebar";
import Breadcrumb from "./components/Breadcrumb";
import FileList from "./components/FileList";
import PermissionsDialog, { Permission } from "./components/PermissionsDialog";
import { FileItemData } from "./components/FileItem";

// Mock data for development
const mockDrives = [
  { id: "1", name: "My Drive", url: "https://storage.example.com/" },
  { id: "2", name: "Shared with me", url: "https://storage.example.com/shared/" },
];

const mockFiles: FileItemData[] = [
  {
    id: "1",
    name: "Documents",
    type: "folder",
    url: "https://storage.example.com/documents/",
    lastModified: new Date(Date.now() - 86400000),
  },
  {
    id: "2",
    name: "example.pdf",
    type: "document",
    url: "https://storage.example.com/example.pdf",
    lastModified: new Date(Date.now() - 3600000),
    size: 1024000,
    mimeType: "application/pdf",
  },
  {
    id: "3",
    name: "photo.jpg",
    type: "image",
    url: "https://storage.example.com/photo.jpg",
    lastModified: new Date(Date.now() - 7200000),
    size: 2048000,
    mimeType: "image/jpeg",
  },
  {
    id: "4",
    name: "Notes",
    type: "folder",
    url: "https://storage.example.com/notes/",
    lastModified: new Date(Date.now() - 172800000),
  },
];

export default function Home() {
  const [selectedDriveId, setSelectedDriveId] = useState<string>("1");
  const [currentPath, setCurrentPath] = useState<string>("/");
  const [selectedFileIds, setSelectedFileIds] = useState<string[]>([]);
  const [files, setFiles] = useState<FileItemData[]>(mockFiles);
  const [permissionsDialogOpen, setPermissionsDialogOpen] = useState(false);
  const [selectedFileForPermissions, setSelectedFileForPermissions] =
    useState<FileItemData | null>(null);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  // Sidebar is open by default on desktop, closed on mobile
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const breadcrumbItems = [
    { name: "My Drive", path: "/" },
    ...(currentPath !== "/" ? [{ name: currentPath.split("/").pop() || "", path: currentPath }] : []),
  ];

  const handleDriveSelect = (driveId: string) => {
    setSelectedDriveId(driveId);
    setCurrentPath("/");
    setSelectedFileIds([]);
    // In real implementation, fetch files for the selected drive
  };

  const handleFileSelect = (file: FileItemData) => {
    setSelectedFileIds((prev) => {
      if (prev.includes(file.id)) {
        return prev.filter((id) => id !== file.id);
      }
      return [...prev, file.id];
    });
  };

  const handleFileDoubleClick = (file: FileItemData) => {
    if (file.type === "folder") {
      setCurrentPath(file.url);
      setSelectedFileIds([]);
      // In real implementation, navigate into folder and fetch its contents
    } else {
      // In real implementation, open/preview the file
      console.log("Open file:", file);
    }
  };

  const handleBreadcrumbNavigate = (path: string) => {
    setCurrentPath(path);
    setSelectedFileIds([]);
    // In real implementation, navigate to the path and fetch files
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
      const file = files.find((f) => f.id === selectedFileIds[0]);
      if (file) {
        handleShareClickForFile(file);
      }
    } else if (selectedFileIds.length > 1) {
      // Handle multiple file sharing (could show a different dialog)
      console.log("Share multiple files:", selectedFileIds);
    }
  };

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
            drives={mockDrives}
            selectedDriveId={selectedDriveId}
            onDriveSelect={handleDriveSelect}
            isOpen={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
          />
          <main className="flex flex-1 flex-col overflow-hidden">
            <Breadcrumb items={breadcrumbItems} onNavigate={handleBreadcrumbNavigate} />
            <FileList
              files={files}
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
