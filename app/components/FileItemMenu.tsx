"use client";

import { useState, useRef, useEffect } from "react";
import Button from "./shared/Button";
import {
  EllipsisVerticalIcon,
  PencilIcon,
  ArrowDownTrayIcon,
  DocumentDuplicateIcon,
  ArrowRightCircleIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import { useClickOutside } from "../lib/hooks";
import { FileItemData } from "./FileItem";

interface FileItemMenuProps {
  file: FileItemData;
  onRename?: (file: FileItemData) => void;
  onDownload?: (file: FileItemData) => void;
  onCopy?: (file: FileItemData) => void;
  onMove?: (file: FileItemData) => void;
  onDelete?: (file: FileItemData) => void;
  position?: "top-right" | "right";
}

export default function FileItemMenu({
  file,
  onRename,
  onDownload,
  onCopy,
  onMove,
  onDelete,
  position = "right",
}: FileItemMenuProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [menuPosition, setMenuPosition] = useState<"bottom" | "top">("bottom");
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useClickOutside({
    isEnabled: showMenu,
    onOutsideClick: () => setShowMenu(false),
    refs: [menuRef, menuButtonRef],
  });

  useEffect(() => {
    if (showMenu && menuButtonRef.current) {
      const buttonRect = menuButtonRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const spaceBelow = viewportHeight - buttonRect.bottom;
      const spaceAbove = buttonRect.top;
      const estimatedMenuHeight = 250; // Approximate height of the menu

      // If there's not enough space below but enough space above, show menu above
      if (spaceBelow < estimatedMenuHeight && spaceAbove > estimatedMenuHeight) {
        setMenuPosition("top");
      } else {
        setMenuPosition("bottom");
      }
    }
  }, [showMenu]);

  const handleAction = (action: ((file: FileItemData) => void) | undefined) => {
    if (action) {
      action(file);
    }
    setShowMenu(false);
  };

  const menuItems = [
    {
      label: "Rename",
      icon: PencilIcon,
      action: onRename,
      className: "text-gray-700 hover:bg-gray-100 border-b border-gray-100",
      iconClassName: "text-gray-500",
    },
    {
      label: "Download",
      icon: ArrowDownTrayIcon,
      action: onDownload,
      className: "text-gray-700 hover:bg-gray-100 border-b border-gray-100",
      iconClassName: "text-gray-500",
    },
    {
      label: "Copy",
      icon: DocumentDuplicateIcon,
      action: onCopy,
      className: "text-gray-700 hover:bg-gray-100 border-b border-gray-100",
      iconClassName: "text-gray-500",
    },
    {
      label: "Move",
      icon: ArrowRightCircleIcon,
      action: onMove,
      className: "text-gray-700 hover:bg-gray-100 border-b border-gray-100",
      iconClassName: "text-gray-500",
    },
    {
      label: "Delete",
      icon: TrashIcon,
      action: onDelete,
      className: "text-red-600 hover:bg-red-50",
      iconClassName: "text-red-500",
    },
  ];

  const menuButton = (
    <Button
      ref={menuButtonRef}
      variant="icon"
      aria-label="More options"
      aria-expanded={showMenu}
      onClick={(e) => {
        e.stopPropagation();
        setShowMenu(!showMenu);
      }}
      className={position === "top-right" ? "bg-white/90 hover:bg-white shadow-sm" : ""}
    >
      <EllipsisVerticalIcon className="h-4 w-4 sm:h-5 sm:w-5" />
    </Button>
  );

  const dropdownMenu = showMenu && (
    <div
      ref={menuRef}
      className={`absolute ${position === "top-right" ? "right-0" : "right-0"} ${
        menuPosition === "top" ? "bottom-full mb-1" : "top-full mt-1"
      } z-[100] w-48 rounded-lg bg-white border border-gray-200 shadow-lg overflow-hidden`}
      role="menu"
      onClick={(e) => e.stopPropagation()}
    >
      {menuItems.map((item, index) => {
        const Icon = item.icon;
        const isLast = index === menuItems.length - 1;
        return (
          <button
            key={item.label}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleAction(item.action);
            }}
            className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors cursor-pointer ${
              isLast ? item.className : `${item.className} border-b border-gray-100`
            }`}
            role="menuitem"
          >
            <Icon className={`h-5 w-5 ${item.iconClassName}`} />
            <span>{item.label}</span>
          </button>
        );
      })}
    </div>
  );

  if (position === "top-right") {
    return (
      <div className="absolute top-2 right-2 z-10">
        <div className="relative">
          {menuButton}
          {dropdownMenu}
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex-shrink-0">
      {menuButton}
      {dropdownMenu}
    </div>
  );
}

