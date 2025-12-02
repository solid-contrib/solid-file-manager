"use client";

import { useState } from "react";
import { CheckCircleIcon, ClipboardIcon, ArrowTopRightOnSquareIcon } from "@heroicons/react/24/outline";
import Modal from "./shared/Modal";
import Button from "./shared/Button";

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

    // Safely extract origin from URL
    const getServerOrigin = () => {
        if (!resourceUrl) return "";
        try {
            return new URL(resourceUrl).origin;
        } catch {
            return "";
        }
    };

    const serverOrigin = getServerOrigin();

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Sharing Successful"
            maxWidth="md"
            footer={
                <div className="flex justify-end gap-3">
                    {onOpenInApp && (
                        <Button
                            onClick={() => {
                                onOpenInApp(resourceUrl);
                                onClose();
                            }}
                            variant="primary"
                            className="flex items-center gap-2"
                        >
                            <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                            Open in File Manager
                        </Button>
                    )}
                    <Button
                        onClick={() => {
                            // Open the resource URL in a new tab
                            // Note: This will show "Not logged in" unless user logs into CSS directly
                            window.open(resourceUrl, "_blank");
                        }}
                        variant="secondary"
                        className="flex items-center gap-2"
                    >
                        <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                        Open in Browser
                    </Button>
                    <Button onClick={onClose} variant="secondary">
                        Done
                    </Button>
                </div>
            }
        >
            {/* Success icon */}
            <div className="flex justify-center mb-4">
                <div className="rounded-full bg-green-100 p-3">
                    <CheckCircleIcon className="h-8 w-8 text-green-600" />
                </div>
            </div>

            {/* Message */}
            <p className="text-gray-600 text-center mb-6">
                <span className="font-medium">{resourceName}</span> has been shared successfully.
                Please copy the resource URL below and send it to the people you shared with.
            </p>

            {/* Resource URL */}
            <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    Resource URL
                </label>
                <div className="flex items-center gap-2">
                    <input
                        type="text"
                        value={resourceUrl}
                        readOnly
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                    <Button
                        onClick={handleCopy}
                        variant="secondary"
                        className="flex items-center gap-2 whitespace-nowrap"
                    >
                        <ClipboardIcon className="h-4 w-4" />
                        {copied ? "Copied!" : "Copy"}
                    </Button>
                </div>
            </div>

        </Modal>
    );
}
