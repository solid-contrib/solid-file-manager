"use client";

import { AlertTriangle } from "lucide-react";
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

interface ErrorDisplayProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  className?: string;
}

export default function ErrorDisplay({
  title = "Something went wrong",
  message,
  onRetry,
  className = "",
}: ErrorDisplayProps) {
  return (
    <Empty
      className={cn("min-h-screen border-0 bg-background", className)}
      role="alert"
      aria-live="assertive"
    >
      <EmptyHeader>
        <EmptyMedia variant="icon" className="text-destructive">
          <AlertTriangle />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{message}</EmptyDescription>
      </EmptyHeader>
      {onRetry ? (
        <EmptyContent>
          <Button variant="default" onClick={onRetry}>
            Try Again
          </Button>
        </EmptyContent>
      ) : null}
    </Empty>
  );
}
