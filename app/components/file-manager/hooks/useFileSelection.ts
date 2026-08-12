"use client";

import { useCallback, useState } from "react";
import type { FileItemData } from "../../FileItem";

export interface UseFileSelectionResult {
  selectedFileIds: string[];
  selectFile: (file: FileItemData) => void;
  clearSelection: () => void;
  removeFromSelection: (fileId: string) => void;
}

/** Tracks which file rows are selected in the main list. */
export function useFileSelection(): UseFileSelectionResult {
  const [selectedFileIds, setSelectedFileIds] = useState<string[]>([]);

  const selectFile = useCallback((file: FileItemData) => {
    setSelectedFileIds([file.id]);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedFileIds([]);
  }, []);

  const removeFromSelection = useCallback((fileId: string) => {
    setSelectedFileIds((prev) => prev.filter((id) => id !== fileId));
  }, []);

  return {
    selectedFileIds,
    selectFile,
    clearSelection,
    removeFromSelection,
  };
}
