"use client";

import { useCallback } from "react";
import { useNameConflictPrompt } from "./useNameConflictPrompt";
import {
    findUploadConflicts,
    uploadFilesToContainer,
    uploadFileWithConflictChoice,
    type UploadResult,
} from "../lib/helpers";

export function useUploadConflictPrompt() {
    const { askConflictChoice, conflictDialog } = useNameConflictPrompt();

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
                const choice = await askConflictChoice(conflict.existingName);
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

    return {
        uploadFilesWithConflictPrompt,
        conflictDialog,
    };
}
