"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Lets the user paste a storage URL when their WebID profile does not list one
 * (e.g. ESS 3 at the moment, which shows it on its Start page instead).
 */
export default function AddStorageForm({ onAdd }: { onAdd: (url: string) => Promise<string | null> }) {
  const inputId = useId();
  const errorId = useId();
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsChecking(true);
    setError(await onAdd(url));
    setIsChecking(false);
  };

  return (
    <form onSubmit={submit} className="mx-auto mt-6 flex w-full max-w-md flex-col gap-2 text-left">
      <label htmlFor={inputId} className="text-sm font-medium text-foreground">
        Storage URL
      </label>
      <Input
        id={inputId}
        type="url"
        required
        placeholder="https://storage.example.org/…/"
        value={url}
        onChange={(event) => setUrl(event.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
      />
      {error && (
        <p id={errorId} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        Your provider shows it after you sign in. On Inrupt ESS, it is on the Start page.
      </p>
      <Button type="submit" disabled={isChecking || url.trim() === ""} className="self-start">
        {isChecking ? "Checking…" : "Add storage"}
      </Button>
    </form>
  );
}
