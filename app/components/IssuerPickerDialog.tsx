"use client";

import { useEffect, useRef } from "react";
import Button from "./shared/Button";
import Modal from "./shared/Modal";

interface IssuerPickerDialogProps {
    isOpen: boolean;
    issuers: string[];
    onSelect: (issuer: string) => void;
    onClose: () => void;
}

export default function IssuerPickerDialog({
    isOpen,
    issuers,
    onSelect,
    onClose,
}: IssuerPickerDialogProps) {
    const firstOptionRef = useRef<HTMLButtonElement>(null);

    // The dialog opens without a click of its own, so focus has to be moved in.
    useEffect(() => {
        if (isOpen) firstOptionRef.current?.focus();
    }, [isOpen]);

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Choose a login server"
            maxWidth="md"
        >
            <p className="mb-4 text-sm text-gray-600">
                That WebID lists more than one. Pick the one to sign in with.
            </p>
            <ul className="space-y-2">
                {issuers.map((issuer, index) => (
                    <li key={issuer}>
                        <Button
                            ref={index === 0 ? firstOptionRef : undefined}
                            variant="secondary"
                            className="w-full text-left"
                            onClick={() => onSelect(issuer)}
                        >
                            {issuer}
                        </Button>
                    </li>
                ))}
            </ul>
        </Modal>
    );
}
