"use client";

import { SVGProps } from "react";

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
  text?: string;
}

const sizeClasses = {
  sm: "h-4 w-4 border-2",
  md: "h-8 w-8 border-4",
  lg: "h-12 w-12 border-4",
};

export default function LoadingSpinner({
  size = "md",
  className = "",
  text,
}: LoadingSpinnerProps) {
  return (
    <main className={`flex flex-col items-center justify-center ${className}`}>
      <div
        className={`inline-block animate-spin rounded-full border-solid border-[#7B42F6] border-r-transparent ${sizeClasses[size]}`}
        role="status"
        aria-label="Loading"
      >
        <span className="sr-only">Loading...</span>
      </div>
      {text && (
        <p className="mt-4 text-sm text-gray-600" aria-live="polite">
          {text}
        </p>
      )}
    </main>
  );
}

