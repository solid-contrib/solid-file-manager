"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

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
    <main
      className={`flex min-h-screen flex-col items-center justify-center bg-background px-4 ${className}`}
      role="alert"
      aria-live="assertive"
    >
      <section className="max-w-md text-center">
        <div className="mb-4 flex justify-center">
          <AlertTriangle className="h-12 w-12 text-destructive" />
        </div>
        <h2 className="mb-2 text-xl font-semibold text-foreground">{title}</h2>
        <p className="mb-6 text-muted-foreground">{message}</p>
        {onRetry && (
          <Button variant="default" onClick={onRetry}>
            Try Again
          </Button>
        )}
      </section>
    </main>
  );
}
