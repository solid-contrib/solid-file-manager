"use client";

import { ReactNode, useEffect } from "react";
import { XMarkIcon } from "@heroicons/react/24/outline";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "4xl" | "6xl" | "7xl";
}

const maxWidthClasses = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
  "2xl": "max-w-2xl",
  "4xl": "max-w-4xl",
  "6xl": "max-w-6xl",
  "7xl": "max-w-7xl",
};

export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  footer,
  maxWidth = "2xl",
}: ModalProps) {
  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <main
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-md p-2 sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <section
        className={`flex h-full max-h-[90vh] w-full ${maxWidthClasses[maxWidth]} flex-col rounded-lg bg-white shadow-xl sm:h-auto`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <header className="border-b border-gray-200 px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex items-center justify-between">
            <h2 id="modal-title" className="text-base font-medium text-black sm:text-lg">
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer rounded-md p-1 text-gray-600 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-[#7B42F6]"
              aria-label="Close dialog"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6">{children}</div>

        {/* Footer */}
        {footer && (
          <footer className="border-t border-gray-200 px-4 py-3 sm:px-6 sm:py-4">
            {footer}
          </footer>
        )}
      </section>
    </main>
  );
}

