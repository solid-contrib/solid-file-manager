"use client";

import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import {
  getFile,
  overwriteFile,
  createContainerAt,
  getSolidDataset,
  getContainedResourceUrlAll,
  UrlString,
} from "@inrupt/solid-client";
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
import FileUploadHandler from "./FileUploadHandler";
import { FileItemData } from "./FileItem";
import LoadingSpinner from "./shared/LoadingSpinner";
import ErrorDisplay from "./shared/ErrorDisplay";
import { useSolidStorages, useBrowseStorage } from "../lib/hooks";
import {
  buildBreadcrumbItems,
  getAuthenticatedSession,
  getDisplayNameFromMeta,
  updateMetaFile,
} from "../lib/helpers";

const INVALID_NAME_CHARS = /[<>:"/\\|?*]/g;

const sanitizeResourceName = (name: string): string => {
  const sanitized = name.replace(INVALID_NAME_CHARS, "").trim();
  return sanitized || "Untitled";
};

const decodeResourceNameFromUrl = (resourceUrl: string): string => {
  try {
    const urlObj = new URL(resourceUrl);
    const segments = urlObj.pathname.split("/").filter(Boolean);
    if (segments.length === 0) {
      return urlObj.hostname;
    }
    const lastSegment = resourceUrl.endsWith("/") ? segments[segments.length - 1] : segments[segments.length - 1];
    return decodeURIComponent(lastSegment);
  } catch {
    return resourceUrl;
  }
};

const ensureTrailingSlash = (url: string): string => (url.endsWith("/") ? url : `${url}/`);

const getParentContainerUrl = (resourceUrl: string): string => {
  try {
    const urlObj = new URL(resourceUrl);
    const segments = urlObj.pathname.split("/").filter(Boolean);
    if (segments.length === 0) {
      return `${urlObj.origin}/`;
    }
    if (!resourceUrl.endsWith("/")) {
      segments.pop();
    } else if (segments.length > 0) {
      segments.pop();
    }
    const parentPath = segments.length ? `/${segments.join("/")}/` : "/";
    return `${urlObj.origin}${parentPath}`;
  } catch {
    return resourceUrl;
  }
};

const shouldSkipResourceCopy = (resourceUrl: string): boolean => {
  return resourceUrl.endsWith(".meta") || resourceUrl.endsWith(".acl");
};

const resourceExists = async (url: string, fetchFn: typeof fetch): Promise<boolean> => {
  try {
    const response = await fetchFn(url, { method: "HEAD" });
    if (response.status === 404) {
      return false;
    }
    if (response.status >= 200 && response.status < 300) {
      return true;
    }
    // For other statuses (401, 403, 405, etc.) assume the resource exists to avoid collisions
    return true;
  } catch {
    return false;
  }
};

const generateCopyTarget = async (
  parentUrl: string,
  desiredName: string,
  isContainer: boolean,
  fetchFn: typeof fetch
): Promise<{ targetUrl: string; displayName: string }> => {
  const parentWithSlash = ensureTrailingSlash(parentUrl);
  let attempt = 0;

  while (attempt < 100) {
    const candidateDisplayName = attempt === 0 ? desiredName : `${desiredName} (${attempt})`;
    const candidatePathName = sanitizeResourceName(candidateDisplayName);
    const encodedName = encodeURIComponent(candidatePathName);
    const candidateUrl = isContainer ? `${parentWithSlash}${encodedName}/` : `${parentWithSlash}${encodedName}`;
    const exists = await resourceExists(candidateUrl, fetchFn);
    if (!exists) {
      return { targetUrl: candidateUrl, displayName: candidateDisplayName };
    }
    attempt += 1;
  }

  throw new Error("Unable to generate a unique name for the copy");
};

const copyFileFromSource = async (
  sourceUrl: string,
  targetUrl: string,
  displayName: string,
  fetchFn: typeof fetch,
  mimeTypeHint?: string
): Promise<void> => {
  const fileBlob = await getFile(sourceUrl as UrlString, { fetch: fetchFn });
  const contentType = fileBlob.type || mimeTypeHint || "application/octet-stream";
  await overwriteFile(targetUrl as UrlString, fileBlob, {
    fetch: fetchFn,
    contentType,
  });
  await updateMetaFile(targetUrl as UrlString, displayName, fetchFn);
};

const copyFolderContents = async (
  sourceFolderUrl: string,
  destinationFolderUrl: string,
  fetchFn: typeof fetch
): Promise<void> => {
  const dataset = await getSolidDataset(sourceFolderUrl, { fetch: fetchFn });
  const containedResources = getContainedResourceUrlAll(dataset);

  for (const resourceUrl of containedResources) {
    if (shouldSkipResourceCopy(resourceUrl)) {
      continue;
    }

    if (resourceUrl.endsWith("/")) {
      const childName = decodeResourceNameFromUrl(resourceUrl);
      const encodedChildName = encodeURIComponent(childName);
      const childDestination = `${ensureTrailingSlash(destinationFolderUrl)}${encodedChildName}/`;

      await createContainerAt(childDestination as UrlString, { fetch: fetchFn });
      const childDisplayName =
        (await getDisplayNameFromMeta(resourceUrl, fetchFn)) ?? childName;
      await updateMetaFile(childDestination as UrlString, childDisplayName, fetchFn);

      await copyFolderContents(resourceUrl, childDestination, fetchFn);
    } else {
      const childName = decodeResourceNameFromUrl(resourceUrl);
      const encodedChildName = encodeURIComponent(childName);
      const childDestination = `${ensureTrailingSlash(destinationFolderUrl)}${encodedChildName}`;
      const childDisplayName =
        (await getDisplayNameFromMeta(resourceUrl, fetchFn)) ?? childName;
      await copyFileFromSource(resourceUrl, childDestination, childDisplayName, fetchFn);
    }
  }
};

const copyFileResource = async (file: FileItemData, fetchFn: typeof fetch): Promise<void> => {
  const originalLabel =
    (await getDisplayNameFromMeta(file.url, fetchFn)) ??
    file.name ??
    decodeResourceNameFromUrl(file.url);
  const parentUrl = getParentContainerUrl(file.url);
  const desiredName = `Copy of ${originalLabel}`;
  const { targetUrl, displayName } = await generateCopyTarget(parentUrl, desiredName, false, fetchFn);
  await copyFileFromSource(file.url, targetUrl, displayName, fetchFn, file.mimeType);
};

const copyFolderResource = async (folder: FileItemData, fetchFn: typeof fetch): Promise<void> => {
  const originalLabel =
    (await getDisplayNameFromMeta(folder.url, fetchFn)) ??
    folder.name ??
    decodeResourceNameFromUrl(folder.url);
  const parentUrl = getParentContainerUrl(folder.url);
  const desiredName = `Copy of ${originalLabel}`;
  const { targetUrl, displayName } = await generateCopyTarget(parentUrl, desiredName, true, fetchFn);

  await createContainerAt(targetUrl as UrlString, { fetch: fetchFn });
  await updateMetaFile(targetUrl as UrlString, displayName, fetchFn);
  await copyFolderContents(folder.url, targetUrl, fetchFn);
};


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
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [fileToRename, setFileToRename] = useState<FileItemData | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [fileToPreview, setFileToPreview] = useState<FileItemData | null>(null);

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

  const handleRenamed = () => {
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

  const storageFiles: FileItemData[] = storages.map((storage) => ({
    id: storage.id,
    name: storage.name,
    type: "folder" as const,
    url: storage.url,
  }));

  const displayFiles = selectedStorageId ? browsedFiles : storageFiles;

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
        <FileUploadHandler
          currentContainerUrl={containerUrlToBrowse}
          onUploadComplete={handleFileUploaded}
          triggerUpload={fileUploadTrigger}
        />
      </div>
    </AuthWrapper>
  );
}
