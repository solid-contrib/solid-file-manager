"use client";

import { ReactNode } from "react";
import { File } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
    icon?: ReactNode;
    title?: string;
    message: string;
    action?: {
        label: string;
        onClick: () => void;
    };
    className?: string;
}

export default function EmptyState({
    icon,
    title,
    message,
    action,
    className = "",
}: EmptyStateProps) {
    return (
        <main
            className={`flex h-full items-center justify-center px-4 py-12 ${className}`}
            role="status"
            aria-live="polite"
        >
            <section className="text-center">
                <div className="mb-4 flex justify-center">
                    {icon || <File className="h-12 w-12 text-muted-foreground" />}
                </div>
                {title && (
                    <h3 className="mb-2 text-lg font-medium text-foreground">{title}</h3>
                )}
                <p className="mb-6 text-muted-foreground">{message}</p>
                {action && (
                    <Button variant="default" onClick={action.onClick}>
                        {action.label}
                    </Button>
                )}
            </section>
        </main>
    );
}
