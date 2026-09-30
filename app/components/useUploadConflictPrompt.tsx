"use client";

import { useCallback, useRef, useState } from "react";
import UploadConflictDialog from "./UploadConflictDialog";
import {
    findUploadConflicts,
    uploadFilesToContainer,
    uploadFileWithConflictChoice,
    type UploadConflict,
    type UploadConflictChoice,
    type UploadResult,
} from "../lib/helpers";

export function useUploadConflictPrompt() {
    const [activeConflict, setActiveConflict] = useState<UploadConflict | null>(null);
    const conflictResolverRef = useRef<((choice: UploadConflictChoice) => void) | null>(null);

    const resolveConflictChoice = useCallback((choice: UploadConflictChoice) => {
        const resolve = conflictResolverRef.current;
        conflictResolverRef.current = null;
        setActiveConflict(null);
        resolve?.(choice);
    }, []);

    const askConflictChoice = useCallback(
        (conflict: UploadConflict) =>
            new Promise<UploadConflictChoice>((resolve) => {
                conflictResolverRef.current = resolve;
                setActiveConflict(conflict);
            }),
        [],
    );

    const uploadFilesWithConflictPrompt = useCallback(
        async (
            files: File[],
            currentContainerUrl: string,
            fetchFn: typeof fetch,
        ): Promise<UploadResult> => {
            const { newFiles, conflicts } = await findUploadConflicts(
                files,
                currentContainerUrl,
                fetchFn,
            );

            const uploadedFiles: string[] = [];
            const failedFiles: string[] = [];

            if (newFiles.length > 0) {
                const result = await uploadFilesToContainer(
                    newFiles,
                    currentContainerUrl,
                    fetchFn,
                );
                uploadedFiles.push(...result.uploadedFiles);
                failedFiles.push(...result.failedFiles);
            }

            for (const conflict of conflicts) {
                const choice = await askConflictChoice(conflict);
                if (choice === "cancel") {
                    continue;
                }

                try {
                    const { uploadedName } = await uploadFileWithConflictChoice(
                        conflict,
                        choice,
                        currentContainerUrl,
                        fetchFn,
                    );
                    uploadedFiles.push(uploadedName);
                } catch {
                    failedFiles.push(conflict.existingName);
                }
            }

            return { uploadedFiles, failedFiles };
        },
        [askConflictChoice],
    );

    const conflictDialog = (
        <UploadConflictDialog
            isOpen={activeConflict !== null}
            fileName={activeConflict?.existingName ?? null}
            onReplace={() => resolveConflictChoice("replace")}
            onKeepBoth={() => resolveConflictChoice("keepBoth")}
            onCancel={() => resolveConflictChoice("cancel")}
        />
    );

    return {
        uploadFilesWithConflictPrompt,
        conflictDialog,
    };
}
