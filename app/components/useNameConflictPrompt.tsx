"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";
import UploadConflictDialog from "./UploadConflictDialog";
import type { UploadConflictChoice } from "../lib/helpers";

export interface NameConflictPrompt {
    askConflictChoice: (existingName: string) => Promise<UploadConflictChoice>;
    conflictDialog: ReactNode;
}

/**
 * Asks the user what to do about a name that is already taken, as an awaitable call.
 */
export function useNameConflictPrompt(): NameConflictPrompt {
    const [activeName, setActiveName] = useState<string | null>(null);
    const resolverRef = useRef<((choice: UploadConflictChoice) => void) | null>(
        null,
    );

    const resolveChoice = useCallback((choice: UploadConflictChoice) => {
        const resolve = resolverRef.current;
        resolverRef.current = null;
        setActiveName(null);
        resolve?.(choice);
    }, []);

    const askConflictChoice = useCallback(
        (existingName: string) =>
            new Promise<UploadConflictChoice>((resolve) => {
                resolverRef.current = resolve;
                setActiveName(existingName);
            }),
        [],
    );

    const conflictDialog = (
        <UploadConflictDialog
            isOpen={activeName !== null}
            fileName={activeName}
            onReplace={() => resolveChoice("replace")}
            onKeepBoth={() => resolveChoice("keepBoth")}
            onCancel={() => resolveChoice("cancel")}
        />
    );

    return { askConflictChoice, conflictDialog };
}
