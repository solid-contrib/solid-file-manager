"use client";

import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import Button from "./Button";

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
      className={`flex min-h-screen flex-col items-center justify-center bg-white px-4 ${className}`}
      role="alert"
      aria-live="assertive"
    >
      <section className="max-w-md text-center">
        <div className="mb-4 flex justify-center">
          <ExclamationTriangleIcon className="h-12 w-12 text-red-500" />
        </div>
        <h2 className="mb-2 text-xl font-semibold text-black">{title}</h2>
        <p className="mb-6 text-gray-600">{message}</p>
        {onRetry && (
          <Button variant="primary" onClick={onRetry}>
            Try Again
          </Button>
        )}
      </section>
    </main>
  );
}

