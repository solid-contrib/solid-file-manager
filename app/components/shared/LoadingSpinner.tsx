"use client";

import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
  text?: string;
}

const sizeClasses = {
  sm: "size-4",
  md: "size-8",
  lg: "size-12",
};

/** Thin wrapper around shadcn Spinner with optional status text. */
export default function LoadingSpinner({
  size = "md",
  className = "",
  text,
}: LoadingSpinnerProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center", className)}>
      <Spinner className={cn("text-primary", sizeClasses[size])} />
      {text ? (
        <p className="mt-4 text-sm text-muted-foreground" aria-live="polite">
          {text}
        </p>
      ) : null}
    </div>
  );
}
