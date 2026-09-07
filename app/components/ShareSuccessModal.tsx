"use client";

import { useState } from "react";
import { CheckCircle, Clipboard, ExternalLink } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface ShareSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  resourceUrl: string;
  resourceName: string;
  onOpenInApp?: (url: string) => void;
}

export default function ShareSuccessModal({
  isOpen,
  onClose,
  resourceUrl,
  resourceName,
  onOpenInApp,
}: ShareSuccessModalProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(resourceUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Sharing Successful</DialogTitle>
        </DialogHeader>
        <div className="mb-4 flex justify-center">
          <div className="rounded-full bg-primary/10 p-3">
            <CheckCircle className="h-8 w-8 text-primary" />
          </div>
        </div>

        <p className="mb-6 text-center text-muted-foreground">
          <span className="font-medium text-foreground">{resourceName}</span> has been shared successfully.
          Please copy the resource URL below and send it to the people you shared with.
        </p>

        <div className="mb-2">
          <label className="mb-2 block text-sm font-medium text-foreground">
            Resource URL
          </label>
          <div className="flex items-center gap-2">
            <Input
              type="text"
              value={resourceUrl}
              readOnly
              className="flex-1"
            />
            <Button
              onClick={handleCopy}
              variant="outline"
              className="flex items-center gap-2 whitespace-nowrap"
            >
              <Clipboard className="h-4 w-4" />
              {copied ? "Copied!" : "Copy"}
            </Button>
          </div>
        </div>
        <DialogFooter>
          {onOpenInApp && (
            <Button
              onClick={() => {
                onOpenInApp(resourceUrl);
                onClose();
              }}
              variant="default"
              className="flex items-center gap-2"
            >
              <ExternalLink className="h-4 w-4" />
              Open in File Manager
            </Button>
          )}
          <Button
            onClick={() => {
              window.open(resourceUrl, "_blank");
            }}
            variant="outline"
            className="flex items-center gap-2"
          >
            <ExternalLink className="h-4 w-4" />
            Open in Browser
          </Button>
          <Button onClick={onClose} variant="outline">
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
