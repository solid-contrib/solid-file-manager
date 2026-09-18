"use client";

import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogMedia,
} from "@/components/ui/alert-dialog";
import { FileWarning } from "lucide-react";

interface UploadConflictDialogProps {
    isOpen: boolean;
    fileName: string | null;
    onReplace: () => void;
    onKeepBoth: () => void;
    onCancel: () => void;
}

export default function UploadConflictDialog({
    isOpen,
    fileName,
    onReplace,
    onKeepBoth,
    onCancel,
}: UploadConflictDialogProps) {
    return (
        <AlertDialog
            open={isOpen}
            onOpenChange={(open) => {
                if (!open) onCancel();
            }}
        >
            <AlertDialogContent size="default">
                <AlertDialogHeader>
                    <AlertDialogMedia className="bg-primary/10 text-primary">
                        <FileWarning />
                    </AlertDialogMedia>
                    <AlertDialogTitle>File already exists</AlertDialogTitle>
                    <AlertDialogDescription>
                        A file named{" "}
                        <span className="font-medium text-foreground">&quot;{fileName}&quot;</span>{" "}
                        already exists in this folder. Do you want to replace it or keep both?
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={onCancel}>Cancel</AlertDialogCancel>
                    <AlertDialogAction variant="outline" onClick={onKeepBoth}>
                        Keep both
                    </AlertDialogAction>
                    <AlertDialogAction onClick={onReplace}>Replace</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
}
