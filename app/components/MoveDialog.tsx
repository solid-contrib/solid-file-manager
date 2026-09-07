"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { getSolidDataset, getContainedResourceUrlAll, UrlString } from "@inrupt/solid-client";
import { toast } from "@/components/ui/toast";
import { FileItemData } from "./FileItem";
import {
  moveFileResource,
  getAuthenticatedSession,
  decodeResourceNameFromUrl,
  ensureTrailingSlash,
} from "../lib/helpers";
import { Folder, AlertTriangle } from "lucide-react";
import LoadingSpinner from "./shared/LoadingSpinner";

interface MoveDialogProps {
  isOpen: boolean;
  onClose: () => void;
  file: FileItemData | null;
  availableFolders: FileItemData[];
  currentLocationUrl: string;
  onMoved?: (destinationUrl: string) => void;
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
            const { fetch: fetchFn } = getAuthenticatedSession();
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
      toast.add({ title: "Please select a destination folder", type: "error" });
      return;
    }

    setIsMoving(true);

    try {
      const { fetch: fetchFn } = getAuthenticatedSession();
      await moveFileResource(file, selectedFolderUrl, fetchFn);

      toast.add({ title: `Moved "${file.name}"`, type: "success" });
      onClose();

      // Notify parent to refresh
      if (onMoved) {
        onMoved(selectedFolderUrl);
      }
    } catch (error) {
      console.error("Failed to move file:", error);
      toast.add({ title: error instanceof Error
          ? `Failed to move: ${error.message}`
          : "Failed to move file", type: "error" });
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
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Move {file.name}</DialogTitle>
        </DialogHeader>
      <main className="py-2" onKeyDown={handleKeyDown}>
        {/* Current Location */}
        <section className="mb-4">
          <label className="block text-sm font-medium text-foreground mb-2">
            Current location:
          </label>
          <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-md border border-border">
            <Folder className="h-5 w-5 text-muted-foreground" />
            <span className="text-sm text-foreground">
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
          <label className="block text-sm font-medium text-foreground mb-2">
            Select a destination:
          </label>
          {isLoadingFolders ? (
            <div className="flex items-center justify-center py-8">
              <LoadingSpinner size="sm" text="Loading folders..." />
            </div>
          ) : filteredFolders.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No folders available to move to
            </div>
          ) : (
            <div className="max-h-64 overflow-y-auto border border-border rounded-md">
              {filteredFolders.map((folder) => (
                <button
                  key={folder.id}
                  type="button"
                  onClick={() => setSelectedFolderUrl(folder.url)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted transition-colors ${selectedFolderUrl === folder.url
                      ? "bg-accent border-l-4 border-primary"
                      : "border-l-4 border-transparent"
                    }`}
                >
                  <Folder className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                  <span className="text-sm text-foreground truncate">{folder.name}</span>
                </button>
              ))}
            </div>
          )}
        </section>

        {filteredFolders.length > 0 && !selectedFolderUrl && (
          <div className="mt-4 flex items-start gap-2 text-sm text-muted-foreground bg-accent border border-border rounded-md p-3">
            <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <span>Select a location to show the folder path</span>
          </div>
        )}
      </main>
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={onClose}
            disabled={isMoving}
          >
            Cancel
          </Button>
          <Button
            variant="default"
            onClick={handleMove}
            disabled={isMoving || !selectedFolderUrl}
            aria-busy={isMoving}
          >
            {isMoving && <Spinner />}
            Move
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

