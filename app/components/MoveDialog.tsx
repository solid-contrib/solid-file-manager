"use client";

import { getAuthFetch } from "../lib/auth/manager";

import { useState, useEffect } from "react";
import Modal from "./shared/Modal";
import Button from "./shared/Button";
import { getSolidDataset, getContainedResourceUrlAll, UrlString } from "@inrupt/solid-client";
import toast from "react-hot-toast";
import { FileItemData } from "./FileItem";
import { 
  moveFileResource, 
  decodeResourceNameFromUrl,
  ensureTrailingSlash,
} from "../lib/helpers";
import { FolderIcon, ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import LoadingSpinner from "./shared/LoadingSpinner";

interface MoveDialogProps {
  isOpen: boolean;
  onClose: () => void;
  file: FileItemData | null;
  availableFolders: FileItemData[];
  currentLocationUrl: string;
  onMoved?: () => void;
}

export default function MoveDialog({
  isOpen,
  onClose,
  file,
  availableFolders,
  currentLocationUrl,
  onMoved,
}: MoveDialogProps) {
  const [selectedFolderUrl, setSelectedFolderUrl] = useState<string | null>(null);
  const [isMoving, setIsMoving] = useState(false);
  const [isLoadingFolders, setIsLoadingFolders] = useState(false);
  const [allFolders, setAllFolders] = useState<FileItemData[]>([]);

  // Recursively fetch all folders from a storage
  const fetchAllFolders = async (containerUrl: string, fetchFn: typeof fetch): Promise<FileItemData[]> => {
    const folders: FileItemData[] = [];
    const visited = new Set<string>();

    const traverse = async (url: string): Promise<void> => {
      const normalizedUrl = ensureTrailingSlash(url);
      if (visited.has(normalizedUrl)) {
        return;
      }
      visited.add(normalizedUrl);

      try {
        const dataset = await getSolidDataset(normalizedUrl as UrlString, { fetch: fetchFn });
        const containedResources = getContainedResourceUrlAll(dataset);

        for (const resourceUrl of containedResources) {
          if (resourceUrl.endsWith("/")) {
            // It's a folder
            const folderName = decodeResourceNameFromUrl(resourceUrl);
            
            folders.push({
              id: resourceUrl,
              name: folderName,
              type: "folder",
              url: resourceUrl,
            });

            // Recursively traverse subfolders
            await traverse(resourceUrl);
          }
        }
      } catch (error) {
        // Skip folders we can't access
        console.warn(`Could not access folder ${url}:`, error);
      }
    };

    await traverse(containerUrl);
    return folders;
  };

  useEffect(() => {
    if (isOpen && file) {
      setSelectedFolderUrl(null);
      setIsMoving(false);
      setIsLoadingFolders(true);
      setAllFolders([]);

      // Find the storage root for this file
      const fileStorage = availableFolders.find(
        (folder) => folder.type === "folder" && file.url.startsWith(folder.url)
      );

      if (fileStorage) {
        const loadFolders = async () => {
          try {
            const fetchFn = getAuthFetch();
            const folders = await fetchAllFolders(fileStorage.url, fetchFn);
            // Include the storage root itself
            setAllFolders([fileStorage, ...folders]);
          } catch (error) {
            console.error("Failed to load folders:", error);
            // Fallback to availableFolders if recursive fetch fails
            setAllFolders(availableFolders.filter(f => f.type === "folder"));
          } finally {
            setIsLoadingFolders(false);
          }
        };

        loadFolders();
      } else {
        // Fallback to availableFolders if we can't find the storage
        setAllFolders(availableFolders.filter(f => f.type === "folder"));
        setIsLoadingFolders(false);
      }
    }
  }, [isOpen, file, availableFolders]);

  const handleMove = async () => {
    if (!file || !selectedFolderUrl) {
      toast.error("Please select a destination folder");
      return;
    }

    setIsMoving(true);

    try {
      const fetchFn = getAuthFetch();
      await moveFileResource(file, selectedFolderUrl, fetchFn);
      
      toast.success(`Moved "${file.name}"`);
      onClose();
      
      // Notify parent to refresh
      if (onMoved) {
        onMoved();
      }
    } catch (error) {
      console.error("Failed to move file:", error);
      toast.error(
        error instanceof Error
          ? `Failed to move: ${error.message}`
          : "Failed to move file"
      );
    } finally {
      setIsMoving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose();
    }
  };

  if (!file) return null;

  // Filter out the current folder (where the file currently is)
  const filteredFolders = allFolders.filter(
    (folder) => folder.type === "folder" && folder.url !== currentLocationUrl
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Move ${file.name}`}
      maxWidth="lg"
      footer={
        <div className="flex justify-end gap-2">
          <Button
            variant="ghost"
            onClick={onClose}
            disabled={isMoving}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleMove}
            isLoading={isMoving}
            disabled={isMoving || !selectedFolderUrl}
          >
            Move
          </Button>
        </div>
      }
    >
      <main className="py-4" onKeyDown={handleKeyDown}>
        {/* Current Location */}
        <section className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Current location:
          </label>
          <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-md border border-gray-200">
            <FolderIcon className="h-5 w-5 text-gray-500" />
            <span className="text-sm text-gray-900">
              {currentLocationUrl 
                ? availableFolders.find(f => f.url === currentLocationUrl)?.name || 
                  (() => {
                    try {
                      const url = new URL(currentLocationUrl);
                      return url.pathname.split("/").filter(Boolean).pop() || currentLocationUrl;
                    } catch {
                      return currentLocationUrl;
                    }
                  })()
                : "My Storages"}
            </span>
          </div>
        </section>

        {/* Available Folders */}
        <section>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select a destination:
          </label>
          {isLoadingFolders ? (
            <div className="flex items-center justify-center py-8">
              <LoadingSpinner size="sm" text="Loading folders..." />
            </div>
          ) : filteredFolders.length === 0 ? (
            <div className="text-center py-8 text-gray-500 text-sm">
              No folders available to move to
            </div>
          ) : (
            <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-md">
              {filteredFolders.map((folder) => (
                <button
                  key={folder.id}
                  type="button"
                  onClick={() => setSelectedFolderUrl(folder.url)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors ${
                    selectedFolderUrl === folder.url
                      ? "bg-[#F3EDFF] border-l-4 border-[#7B42F6]"
                      : "border-l-4 border-transparent"
                  }`}
                >
                  <FolderIcon className="h-5 w-5 text-gray-500 flex-shrink-0" />
                  <span className="text-sm text-gray-900 truncate">{folder.name}</span>
                </button>
              ))}
            </div>
          )}
        </section>

        {filteredFolders.length > 0 && !selectedFolderUrl && (
          <div className="mt-4 flex items-start gap-2 text-sm text-gray-600 bg-yellow-50 border border-yellow-200 rounded-md p-3">
            <ExclamationTriangleIcon className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <span>Select a location to show the folder path</span>
          </div>
        )}
      </main>
    </Modal>
  );
}

