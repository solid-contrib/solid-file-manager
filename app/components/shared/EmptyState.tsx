"use client";

import { ReactNode } from "react";
import { File } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { cn } from "@/lib/utils";

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
    <Empty
      className={cn("h-full border-0", className)}
      role="status"
      aria-live="polite"
    >
      <EmptyHeader>
        <EmptyMedia variant="icon">{icon || <File />}</EmptyMedia>
        {title ? <EmptyTitle>{title}</EmptyTitle> : null}
        <EmptyDescription>{message}</EmptyDescription>
      </EmptyHeader>
      {action ? (
        <EmptyContent>
          <Button variant="default" onClick={action.onClick}>
            {action.label}
          </Button>
        </EmptyContent>
      ) : null}
    </Empty>
  );
}
