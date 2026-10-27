"use client";

import { useState, useEffect, useId } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { FileItemData } from "./FileItem";
import {
  moveFileResource,
  moveFileWithConflictChoice,
  findMoveConflict,
  getAuthenticatedSession,
  getParentContainerUrl,
  ensureTrailingSlash,
  folderUrlsEqual,
  describeMoveError,
  describeMoveResult,
  extractNameFromUrl,
  type FolderTreeChild,
  type MoveResult,
} from "../lib/helpers";
import { useNameConflictPrompt } from "./useNameConflictPrompt";
import { Folder } from "lucide-react";
import FolderTreePicker from "./FolderTreePicker";

interface MoveDialogProps {
  isOpen: boolean;
  onClose: () => void;
  file: FileItemData | null;
  availableFolders: FileItemData[];
  currentLocationUrl: string;
  onMoved?: (destinationUrl: string) => void;
}

function folderPathLabel(folderUrl: string): string {
  try {
    return decodeURIComponent(new URL(folderUrl).pathname.replace(/\/$/, "")) || "";
  } catch {
    return folderUrl;
  }
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
  const [newName, setNewName] = useState("");
  const nameInputId = useId();
  const { askConflictChoice, conflictDialog } = useNameConflictPrompt();

  const trimmedName = newName.trim();
  // A slash would change which container the resource lands in, not just its
  // name, so block it here.
  const nameError =
    newName.includes("/") || newName.includes("\\")
      ? "A name cannot contain / or \\"
      : null;

  useEffect(() => {
    if (isOpen && file) {
      setSelectedFolderUrl(null);
      setIsMoving(false);
      setNewName(file.name);
    }
  }, [isOpen, file]);

  const handleMove = async () => {
    if (!file || !selectedFolderUrl) {
      toast.add({ title: "Please select a destination folder", type: "error" });
      return;
    }

    let fetchFn: typeof fetch;
    try {
      ({ fetch: fetchFn } = getAuthenticatedSession());
    } catch {
      toast.add({ title: "Not authenticated", type: "error" });
      return;
    }

    setIsMoving(true);

    try {
      // Ask before transferring anything, so a clash does not cost a round trip
      // of the file's bytes. The server's own 409 is still the backstop.
      const conflict = await findMoveConflict(
        selectedFolderUrl,
        trimmedName,
        fetchFn,
      );

      let result: MoveResult;

      if (conflict) {
        const choice = await askConflictChoice(conflict.existingName);
        if (choice === "cancel") {
          return;
        }

        result = await moveFileWithConflictChoice(
          file,
          selectedFolderUrl,
          trimmedName,
          conflict,
          choice,
          fetchFn,
        );
      } else {
        result = await moveFileResource(file, selectedFolderUrl, fetchFn, trimmedName);
      }

      toast.add(describeMoveResult(result));
      onClose();

      // Notify parent to refresh
      if (onMoved) {
        onMoved(getParentContainerUrl(result.url));
      }
    } catch (error) {
      console.error("Failed to move file:", error);
      toast.add(describeMoveError(error));
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

  // Move is scoped to the storage the file already lives in.
  const fileStorage = availableFolders.find(
    (folder) => folder.type === "folder" && file.url.startsWith(folder.url),
  );

  const roots: FolderTreeChild[] = fileStorage
    ? [{ url: ensureTrailingSlash(fileStorage.url), name: fileStorage.name }]
    : [];

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Move</DialogTitle>
            <DialogDescription className="truncate">
              {file.name}
            </DialogDescription>
          </DialogHeader>
          <main className="py-2" onKeyDown={handleKeyDown}>
            {/* Name */}
            <section className="mb-4">
              <label
                htmlFor={nameInputId}
                className="block text-sm font-medium text-foreground mb-2"
              >
                Name:
              </label>
              <Input
                id={nameInputId}
                type="text"
                value={newName}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setNewName(e.target.value)
                }
                disabled={isMoving}
                aria-invalid={nameError ? true : undefined}
                aria-describedby={nameError ? `${nameInputId}-error` : undefined}
              />
              {nameError && (
                <p
                  id={`${nameInputId}-error`}
                  className="mt-1 text-xs text-destructive"
                  role="alert"
                >
                  {nameError}
                </p>
              )}
            </section>
            {/* Current Location */}
            <section className="mb-4">
              <label className="block text-sm font-medium text-foreground mb-2">
                Current location:
              </label>
              <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-md border border-border">
                <Folder className="h-5 w-5 text-muted-foreground" />
                <span className="text-sm text-foreground">
                  {currentLocationUrl
                    ? availableFolders.find((f) =>
                      folderUrlsEqual(f.url, currentLocationUrl),
                    )?.name || extractNameFromUrl(currentLocationUrl)
                    : "My Storages"}
                </span>
              </div>
            </section>

            {/* Destination */}
            <section>
              <label className="block text-sm font-medium text-foreground mb-2">
                Select a destination:
              </label>
              <div className="max-h-80 overflow-y-auto border border-border rounded-md">
                <FolderTreePicker
                  roots={roots}
                  selectedUrl={selectedFolderUrl}
                  onSelect={setSelectedFolderUrl}
                  disabledUrl={currentLocationUrl}
                />
              </div>
            </section>

            {selectedFolderUrl && (
              <div className="mt-4 rounded-md border border-border bg-accent p-3">
                <p className="text-xs text-muted-foreground">Moving to</p>
                <p
                  className="mt-0.5 truncate text-sm text-foreground"
                  title={selectedFolderUrl}
                >
                  {folderPathLabel(selectedFolderUrl)}
                </p>
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
              disabled={isMoving || !selectedFolderUrl || !trimmedName || nameError !== null}
              aria-busy={isMoving}
            >
              {isMoving && <Spinner />}
              Move
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {conflictDialog}
    </>
  );
}

