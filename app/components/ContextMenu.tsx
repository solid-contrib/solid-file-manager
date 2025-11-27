"use client";

import { useEffect, useRef, useState } from "react";
import type { ElementType } from "react";

export interface ContextMenuAction {
  label: string;
  icon: ElementType;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}

interface ContextMenuProps {
  position: { x: number; y: number };
  actions: ContextMenuAction[];
  onClose: () => void;
}

export default function ContextMenu({ position, actions, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuPosition, setMenuPosition] = useState(position);

  useEffect(() => {
    const adjustPosition = () => {
      const menuWidth = menuRef.current?.offsetWidth ?? 200;
      const menuHeight = menuRef.current?.offsetHeight ?? actions.length * 40;

      let top = position.y;
      let left = position.x;

      if (top + menuHeight > window.innerHeight) {
        top = Math.max(0, window.innerHeight - menuHeight - 8);
      }
      if (left + menuWidth > window.innerWidth) {
        left = Math.max(0, window.innerWidth - menuWidth - 8);
      }

      setMenuPosition({ x: left, y: top });
    };

    adjustPosition();
  }, [position, actions.length]);

  useEffect(() => {
    const handleScroll = () => onClose();
    const handleResize = () => onClose();

    window.addEventListener("scroll", handleScroll, true);
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("resize", handleResize);
    };
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      className="fixed z-[999] w-52 rounded-lg border border-gray-200 bg-white shadow-lg"
      style={{ top: menuPosition.y, left: menuPosition.x }}
      role="menu"
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      {actions.map((action) => {
        const Icon = action.icon;
        return (
          <button
            key={action.label}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (action.disabled) return;
              action.onClick();
            }}
            className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors ${
              action.danger
                ? "text-red-600 hover:bg-red-50"
                : action.disabled
                ? "text-gray-400 cursor-not-allowed"
                : "text-gray-700 hover:bg-gray-100"
            }`}
            role="menuitem"
            disabled={action.disabled}
          >
            <Icon
              className={`h-5 w-5 ${
                action.danger ? "text-red-500" : action.disabled ? "text-gray-300" : "text-gray-500"
              }`}
            />
            <span>{action.label}</span>
          </button>
        );
      })}
    </div>
  );
}


