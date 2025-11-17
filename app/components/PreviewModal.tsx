"use client";

import { useState, useEffect, useRef } from "react";
import Modal from "./shared/Modal";
import Button from "./shared/Button";
import { getDefaultSession } from "@inrupt/solid-client-authn-browser";
import { getFile, UrlString } from "@inrupt/solid-client";
import { FileItemData } from "./FileItem";
import LoadingSpinner from "./shared/LoadingSpinner";
import { getFileType } from "../lib/helpers";

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
      setIsLoading(false);
      return;
    }

    const loadPreview = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const session = getDefaultSession();
        if (!session.info.isLoggedIn) {
          throw new Error("Not authenticated");
        }

        const fetchFn = session.fetch || fetch;
        const fileTypeDetected = getFileType(file.url, file.mimeType, file.name);
        setFileType(fileTypeDetected);

        // PDFs open directly in a new tab
        if (fileTypeDetected === "pdf") {
          if (blobUrlRef.current) {
            URL.revokeObjectURL(blobUrlRef.current);
          }
          // For PDFs, fetch as blob and open in new tab
          const fileBlob = await getFile(file.url as UrlString, { fetch: fetchFn });
          const blobUrl = URL.createObjectURL(fileBlob);
          blobUrlRef.current = blobUrl;
          window.open(blobUrl, "_blank");
       
          onClose();
          setIsLoading(false);
          return;
        }

        // Word documents - browsers can't natively view them, so we'll fetch and open as blob
        // This will trigger a download, but ensures authenticated access works
        if (fileTypeDetected === "doc") {
          // Clean up previous blob URL if it exists
          if (blobUrlRef.current) {
            URL.revokeObjectURL(blobUrlRef.current);
          }
          // For Word docs, fetch as blob and create a download link
          // Note: Browsers can't natively view Word documents, so this will download
          // External viewers (Google Docs, Office Online) require public URLs and won't work with authenticated resources
          const fileBlob = await getFile(file.url as UrlString, { fetch: fetchFn });
          const blobUrl = URL.createObjectURL(fileBlob);
          blobUrlRef.current = blobUrl;
          
          // Create a temporary anchor element to trigger download with proper filename
          const link = document.createElement("a");
          link.href = blobUrl;
          link.download = file.name;
          link.target = "_blank";
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          
          // Close the modal
          onClose();
          setIsLoading(false);
          return;
        }

        if (fileTypeDetected === "image") {
          // Clean up previous blob URL if it exists
          if (blobUrlRef.current) {
            URL.revokeObjectURL(blobUrlRef.current);
          }
          // For images, fetch as blob and create blob URL for authenticated access
          const fileBlob = await getFile(file.url as UrlString, { fetch: fetchFn });
          const blobUrl = URL.createObjectURL(fileBlob);
          blobUrlRef.current = blobUrl;
          setPreviewUrl(blobUrl);
          setIsLoading(false);
        } else if (fileTypeDetected === "text") {
          // For text files, fetch and display content
          const fileBlob = await getFile(file.url as UrlString, { fetch: fetchFn });
          const text = await fileBlob.text();
          setPreviewContent(text);
          setIsLoading(false);
        } else {
          // For other file types, try to read as text as a fallback
          try {
            const fileBlob = await getFile(file.url as UrlString, { fetch: fetchFn });
            // Check if the blob type suggests it's text
            if (fileBlob.type && (fileBlob.type.startsWith("text/") || fileBlob.type === "application/json" || fileBlob.type === "application/xml")) {
              const text = await fileBlob.text();
              setPreviewContent(text);
              setFileType("text");
              setIsLoading(false);
            } else {
              const text = await fileBlob.text();
              // If we can read it as text and it's not too large, treat it as text
              if (text.length > 0 && text.length < 10 * 1024 * 1024) { // Less than 10MB
                setPreviewContent(text);
                setFileType("text");
                setIsLoading(false);
              } else {
                setIsLoading(false);
              }
            }
          } catch (err) {
            // If reading as text fails, it's not a text file
            setIsLoading(false);
          }
        }
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
        <div className="flex h-96 items-center justify-center">
          <LoadingSpinner size="md" text="Loading preview..." />
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex h-96 flex-col items-center justify-center text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <Button variant="primary" onClick={onClose}>
            Close
          </Button>
        </div>
      );
    }

    if (fileType === "image") {
      if (!previewUrl) {
        return (
          <div className="flex h-96 items-center justify-center">
            <LoadingSpinner size="md" text="Loading image..." />
          </div>
        );
      }
      return (
        <div className="flex min-h-[80vh] items-center justify-center bg-gray-50 p-4">
          <img
            src={previewUrl}
            alt={file.name}
            className="max-h-[80vh] max-w-full object-contain"
            onError={() => setError("Failed to load image")}
          />
        </div>
      );
    }

    if (fileType === "text") {
      return (
        <div className="min-h-[80vh] overflow-auto">
          <pre className="whitespace-pre-wrap break-words p-4 font-mono text-sm text-gray-800 bg-gray-50 rounded">
            {previewContent || ""}
          </pre>
        </div>
      );
    }

    // For other file types
    return (
      <div className="flex h-96 flex-col items-center justify-center text-center">
        <p className="text-gray-600 mb-4">
          Preview is not available for this file type.
        </p>
        <p className="text-sm text-gray-500 mb-6">
          Please download the file to view it.
        </p>
        <Button variant="primary" onClick={onClose}>
          Close
        </Button>
      </div>
    );
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Preview: ${file.name}`}
      maxWidth="6xl"
    >
      {renderPreview()}
    </Modal>
  );
}

