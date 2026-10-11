"use client";

import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { AlertCircle, FileWarning } from "lucide-react";
import { getFile, UrlString } from "@inrupt/solid-client";
import { getAuthenticatedSession } from "../lib/helpers";
import { FileItemData } from "./FileItem";
import { getHttpStatus } from "../lib/helpers";

interface PreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  file: FileItemData | null;
}

export default function PreviewModal({
  isOpen,
  onClose,
  file,
}: PreviewModalProps) {
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileType, setFileType] = useState<"image" | "pdf" | "doc" | "text" | "other">("other");
  const [previewUnavailableReason, setPreviewUnavailableReason] = useState<string | null>(null);
  const blobUrlRef = useRef<string | null>(null);

  // Clean up blob URLs when component unmounts
  useEffect(() => {
    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!isOpen || !file) {
      // Clean up previous blob URL
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
      setPreviewContent(null);
      setPreviewUrl(null);
      setError(null);
      setPreviewUnavailableReason(null);
      setIsLoading(false);
      return;
    }

    const loadPreview = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const { fetch: fetchFn } = getAuthenticatedSession();


        let fileBlob: Blob;
        let actualMimeType: string = "";

        try {
          fileBlob = await getFile(file.url as UrlString, { fetch: fetchFn });
          // Get the content-type from the blob's type property (set from HTTP response header)
          actualMimeType = fileBlob.type ? fileBlob.type.split(";")[0].trim() : "";
        } catch (getFileError: unknown) {
          const statusCode = getHttpStatus(getFileError);
          const errorMessage = getFileError instanceof Error ? getFileError.message : String(getFileError);

          if (statusCode === 501 ||
            errorMessage.includes("501") ||
            errorMessage.includes("Not Implemented") ||
            errorMessage.includes("No conversion path")) {

            const response = await fetchFn(file.url);

            if (response.status === 501) {

              const contentType = response.headers.get("content-type") || "";

              if (contentType.includes("text/turtle") || contentType.includes("application/json")) {
                // Can't preview - server returned error instead of file
                setFileType("other");
                setPreviewUnavailableReason("This binary file cannot be converted to a previewable format by the server. Please download the file to view it.");
                setIsLoading(false);
                return;
              }

              try {
                fileBlob = await response.blob();
                actualMimeType = contentType.split(";")[0].trim();
              } catch {
                setFileType("other");
                setIsLoading(false);
                return;
              }
            } else if (!response.ok) {
              throw new Error(`Failed to fetch file: ${response.status} ${response.statusText}`);
            } else {
              fileBlob = await response.blob();
              const contentType = response.headers.get("content-type") || "";
              actualMimeType = contentType.split(";")[0].trim();
            }
          } else {
            throw getFileError;
          }
        }

        if (blobUrlRef.current) {
          URL.revokeObjectURL(blobUrlRef.current);
        }

        const blobUrl = URL.createObjectURL(fileBlob);
        blobUrlRef.current = blobUrl;

        // PDFs: open in new tab
        if (actualMimeType === "application/pdf") {
          window.open(blobUrl, "_blank");
          onClose();
          setIsLoading(false);
          return;
        }

        // Word documents: browsers can't natively view them, trigger download
        if (actualMimeType.startsWith("application/msword") ||
          actualMimeType.includes("wordprocessingml") ||
          actualMimeType.includes("ms-word")) {
          const link = document.createElement("a");
          link.href = blobUrl;
          link.download = file.name;
          link.target = "_blank";
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          onClose();
          setIsLoading(false);
          return;
        }

        // Images: display in modal
        if (actualMimeType.startsWith("image/")) {
          setPreviewUrl(blobUrl);
          setFileType("image");
          setIsLoading(false);
          return;
        }

        // Check if this is a binary file that shouldn't be read as text
        let isBinaryFile = false;
        let reason = "";

        if (file.name.endsWith(".DS_Store") || file.name.endsWith(".ds_store")) {
          isBinaryFile = true;
          reason = "This is a macOS system file (binary format) that cannot be displayed as text.";
        } else if (!actualMimeType || actualMimeType === "application/octet-stream") {
          isBinaryFile = true;
          reason = "This file is in a binary format that cannot be previewed in the browser.";
        } else if (actualMimeType.includes("binary")) {
          isBinaryFile = true;
          reason = "This is a binary file that cannot be displayed as text.";
        } else if (actualMimeType &&
          !actualMimeType.startsWith("text/") &&
          !actualMimeType.includes("json") &&
          !actualMimeType.includes("xml") &&
          !actualMimeType.includes("javascript") &&
          !actualMimeType.includes("yaml") &&
          !actualMimeType.includes("csv") &&
          actualMimeType !== "application/pdf" &&
          !actualMimeType.startsWith("image/") &&
          !actualMimeType.startsWith("application/msword") &&
          !actualMimeType.includes("wordprocessingml") &&
          !actualMimeType.includes("ms-word")) {
          isBinaryFile = true;
          reason = `This file type (${actualMimeType}) is not supported for preview. Please download the file to view it.`;
        }

        if (isBinaryFile) {

          setFileType("other");
          setPreviewUnavailableReason(reason);
          setIsLoading(false);
          return;
        }

        try {
          const text = await fileBlob.text();
          if (text.length > 0 && text.length < 10 * 1024 * 1024) { // Less than 10MB
            setPreviewContent(text);
            setFileType("text");
            setIsLoading(false);
            return;
          }
        } catch (err) {
          console.error("Failed to load preview:", err);
        }

        setFileType("other");
        setIsLoading(false);
      } catch (err) {
        console.error("Failed to load preview:", err);
        setError(err instanceof Error ? err.message : "Failed to load preview");
        setIsLoading(false);
      }
    };

    loadPreview();
  }, [isOpen, file, onClose]);

  if (!file) return null;

  const renderPreview = () => {
    if (isLoading) {
      return (
        <div className="flex min-h-64 flex-col items-center justify-center gap-3 py-12">
          <Spinner className="size-6" />
          <p className="text-sm text-muted-foreground">Loading preview...</p>
        </div>
      );
    }

    if (error) {
      return (
        <Empty className="min-h-64 border-0 py-12">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <AlertCircle className="text-destructive" />
            </EmptyMedia>
            <EmptyTitle>Preview failed</EmptyTitle>
            <EmptyDescription>{error}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      );
    }

    if (fileType === "image") {
      if (!previewUrl) {
        return (
          <div className="flex min-h-64 flex-col items-center justify-center gap-3 py-12">
            <Spinner className="size-6" />
            <p className="text-sm text-muted-foreground">Loading image...</p>
          </div>
        );
      }
      return (
        <div className="flex min-h-64 items-center justify-center rounded-2xl bg-muted p-4">
          {/* Solid preview URLs are authenticated/cross-origin; next/image is not suitable here */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt={file.name}
            className="max-h-[60vh] max-w-full object-contain"
            onError={() => setError("Failed to load image")}
          />
        </div>
      );
    }

    if (fileType === "text") {
      return (
        <div className="min-h-64 overflow-auto rounded-2xl bg-muted">
          <pre className="wrap-break-word whitespace-pre-wrap p-4 font-mono text-sm text-foreground">
            {previewContent || ""}
          </pre>
        </div>
      );
    }

    return (
      <Empty className="min-h-64 border-0 py-12">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <FileWarning />
          </EmptyMedia>
          <EmptyTitle>Preview not available</EmptyTitle>
          <EmptyDescription>
            {previewUnavailableReason ||
              "This file type cannot be previewed in the browser. Download the file to view it."}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-4 overflow-hidden sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Preview</DialogTitle>
          <DialogDescription className="truncate">
            {file.name}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-auto">
          {renderPreview()}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

