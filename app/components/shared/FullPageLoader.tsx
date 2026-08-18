"use client";

import LoadingSpinner from "./LoadingSpinner";

export default function FullPageLoader({ text = "Loading..." }: { text?: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-white">
      <LoadingSpinner size="md" text={text} />
    </div>
  );
}
