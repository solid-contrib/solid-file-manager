"use client";

import { useState, useEffect, useCallback } from "react";
import Modal from "./shared/Modal";
import Button from "./shared/Button";
import toast from "react-hot-toast";
import { FileItemData } from "./FileItem";
import {
  moveFileResource,
  getAuthenticatedSession,
  ensureTrailingSlash,
  fetchFolderChildren,
  FolderPickerChild,
} from "../lib/helpers";
import {
  FolderIcon,
  ExclamationTriangleIcon,
  ChevronRightIcon,
  ChevronDownIcon,
} from "@heroicons/react/24/outline";

interface MoveDialogProps {
  isOpen: boolean;
  onClose: () => void;
  file: FileItemData | null;
  storageFolders: FileItemData[];
  currentLocationUrl: string;
  onMoved?: () => void;
}

export default function MoveDialog({
  isOpen,
  onClose,
  file,
  storageFolders,
  currentLocationUrl,
  onMoved,
}: MoveDialogProps) {
  const [selectedFolderUrl, setSelectedFolderUrl] = useState<string | null>(null);
  const [isMoving, setIsMoving] = useState(false);
  const [expandedUrls, setExpandedUrls] = useState<Set<string>>(new Set());
  const [childrenByUrl, setChildrenByUrl] = useState<Record<string, FolderPickerChild[]>>({});
  const [loadingUrls, setLoadingUrls] = useState<Set<string>>(new Set());
  const [errorByUrl, setErrorByUrl] = useState<Record<string, string>>({});

  // Reset picker state when the dialog opens. No network on open.
  useEffect(() => {
    if (!isOpen || !file) {
      return;
    }
    setSelectedFolderUrl(null);
    setIsMoving(false);
    setExpandedUrls(new Set());
    setChildrenByUrl({});
    setLoadingUrls(new Set());
    setErrorByUrl({});
  }, [isOpen, file]);

  // Fetch one level of child folders and cache them.
  const loadChildren = useCallback(
    async (folderUrl: string) => {
      const normalizedUrl = ensureTrailingSlash(folderUrl);

      if (childrenByUrl[normalizedUrl]) {
        return;
      }

      setLoadingUrls((prev) => {
        const next = new Set(prev);
        next.add(normalizedUrl);
        return next;
      });

      setErrorByUrl((prev) => {
        if (!(normalizedUrl in prev)) return prev;
        const next = { ...prev };
        delete next[normalizedUrl];
        return next;
      });

      try {
        const { fetch: fetchFn } = getAuthenticatedSession();
        const children = await fetchFolderChildren(normalizedUrl, fetchFn);
        setChildrenByUrl((prev) => ({ ...prev, [normalizedUrl]: children }));
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to load folders";
        setErrorByUrl((prev) => ({ ...prev, [normalizedUrl]: message }));
      } finally {
        setLoadingUrls((prev) => {
          const next = new Set(prev);
          next.delete(normalizedUrl);
          return next;
        });
      }
    },
    [childrenByUrl],
  );

  // Open or close a branch. Fetch children only when opening.
  const toggleExpand = useCallback(
    async (folderUrl: string) => {
      const normalizedUrl = ensureTrailingSlash(folderUrl);
      const isExpanded = expandedUrls.has(normalizedUrl);

      if (isExpanded) {
        setExpandedUrls((prev) => {
          const next = new Set(prev);
          next.delete(normalizedUrl);
          return next;
        });
        return;
      }

      setExpandedUrls((prev) => {
        const next = new Set(prev);
        next.add(normalizedUrl);
        return next;
      });

      await loadChildren(normalizedUrl);
    },
    [expandedUrls, loadChildren],
  );

  const handleMove = async () => {
    if (!file || !selectedFolderUrl) {
      toast.error("Please select a destination folder");
      return;
    }

    setIsMoving(true);

    try {
      const { fetch: fetchFn } = getAuthenticatedSession();
      await moveFileResource(file, selectedFolderUrl, fetchFn);

      toast.success(`Moved "${file.name}"`);
      onClose();

      if (onMoved) {
        onMoved();
      }
    } catch (error) {
      console.error("Failed to move file:", error);
      toast.error(
        error instanceof Error
          ? `Failed to move: ${error.message}`
          : "Failed to move file",
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

  // Render one folder row and its children when expanded.
  const renderNode = (node: FolderPickerChild, depth: number) => {
    const nodeUrl = ensureTrailingSlash(node.url);
    const currentUrl = currentLocationUrl
      ? ensureTrailingSlash(currentLocationUrl)
      : "";
    const isCurrentLocation = currentUrl !== "" && nodeUrl === currentUrl;
    const isExpanded = expandedUrls.has(nodeUrl);
    const isLoading = loadingUrls.has(nodeUrl);
    const children = childrenByUrl[nodeUrl] || [];
    const hasError = Boolean(errorByUrl[nodeUrl]);
    const isSelected = selectedFolderUrl === nodeUrl;

    return (
      <li key={nodeUrl}>
        <div
          className={`flex items-center gap-1 border-l-4 px-2 py-2 text-sm ${isSelected
              ? "border-[#7B42F6] bg-[#F3EDFF]"
              : "border-transparent hover:bg-gray-50"
            }`}
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
        >
          <button
            type="button"
            onClick={() => void toggleExpand(nodeUrl)}
            className="rounded p-0.5 hover:bg-gray-200"
            aria-label={isExpanded ? `Collapse ${node.name}` : `Expand ${node.name}`}
            aria-expanded={isExpanded}
          >
            {isExpanded ? (
              <ChevronDownIcon className="h-4 w-4" aria-hidden="true" />
            ) : (
              <ChevronRightIcon className="h-4 w-4" aria-hidden="true" />
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              if (!isCurrentLocation) {
                setSelectedFolderUrl(nodeUrl);
              }
            }}
            disabled={isCurrentLocation}
            className={`flex min-w-0 flex-1 items-center gap-2 text-left ${isCurrentLocation ? "cursor-not-allowed opacity-50" : ""
              }`}
            title={
              isCurrentLocation
                ? "File is already in this folder"
                : node.name
            }
          >
            <FolderIcon className="h-4 w-4 shrink-0 text-gray-500" aria-hidden="true" />
            <span className="truncate text-gray-900">{node.name}</span>
          </button>
        </div>

        {isExpanded && (
          <ul>
            {isLoading && (
              <li
                className="px-2 py-1 text-xs text-gray-500"
                style={{ paddingLeft: `${(depth + 1) * 12 + 8}px` }}
              >
                Loading...
              </li>
            )}

            {!isLoading && hasError && (
              <li
                className="px-2 py-1 text-xs text-red-600"
                style={{ paddingLeft: `${(depth + 1) * 12 + 8}px` }}
              >
                Failed to load folders
              </li>
            )}

            {!isLoading && !hasError && children.length === 0 && (
              <li
                className="px-2 py-1 text-xs text-gray-500"
                style={{ paddingLeft: `${(depth + 1) * 12 + 8}px` }}
              >
                No folders
              </li>
            )}

            {!isLoading &&
              !hasError &&
              children.map((child) => renderNode(child, depth + 1))}
          </ul>
        )}
      </li>
    );
  };

  if (!file) return null;

  const rootNodes: FolderPickerChild[] = storageFolders.map((folder) => ({
    url: ensureTrailingSlash(folder.url),
    name: folder.name || folder.url,
  }));

  const currentLocationName = (() => {
    if (!currentLocationUrl) return "My Storages";
    try {
      const path = new URL(currentLocationUrl).pathname;
      return path.split("/").filter(Boolean).pop() || currentLocationUrl;
    } catch {
      return currentLocationUrl;
    }
  })();

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Move ${file.name}`}
      maxWidth="lg"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={isMoving}>
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
        <section className="mb-4">
          <label className="mb-2 block text-sm font-medium text-gray-700">
            Current location:
          </label>
          <div className="flex items-center gap-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-2">
            <FolderIcon className="h-5 w-5 text-gray-500" aria-hidden="true" />
            <span className="text-sm text-gray-900">{currentLocationName}</span>
          </div>
        </section>

        <section>
          <label className="mb-2 block text-sm font-medium text-gray-700">
            Select a destination:
          </label>
          {rootNodes.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-500">
              No folders available to move to
            </div>
          ) : (
            <ul className="max-h-64 overflow-y-auto rounded-md border border-gray-200">
              {rootNodes.map((node) => renderNode(node, 0))}
            </ul>
          )}
        </section>

        {!selectedFolderUrl && rootNodes.length > 0 && (
          <div className="mt-4 flex items-start gap-2 rounded-md border border-yellow-200 bg-yellow-50 p-3 text-sm text-gray-600">
            <ExclamationTriangleIcon className="mt-0.5 h-5 w-5 shrink-0 text-yellow-600" />
            <span>Select a destination folder</span>
          </div>
        )}
      </main>
    </Modal>
  );
}