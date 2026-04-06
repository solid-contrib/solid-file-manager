"use client";

import { ReactNode } from "react";
import Button from "./Button";
import { ListBulletIcon, Squares2X2Icon, ShieldCheckIcon } from "@heroicons/react/24/outline";

interface ToolbarProps {
  view: "list" | "grid";
  onViewChange: (view: "list" | "grid") => void;
  itemCount: number;
  actions?: ReactNode;
  showPermissions?: boolean;
  onTogglePermissions?: () => void;
}

export default function Toolbar({
  view,
  onViewChange,
  itemCount,
  actions,
  showPermissions,
  onTogglePermissions,
}: ToolbarProps) {
  return (
    <header className="flex items-center justify-between border-b border-gray-200 px-2 py-2 sm:px-4">
      <nav className="flex items-center gap-1 sm:gap-2" aria-label="View options">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onViewChange("list")}
          className={`p-1.5 sm:p-2 ${
            view === "list"
              ? "bg-[#F3EDFF] text-black"
              : "text-gray-600 hover:bg-gray-100"
          }`}
          aria-label="List view"
          aria-pressed={view === "list"}
        >
          <ListBulletIcon className="h-4 w-4 sm:h-5 sm:w-5" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onViewChange("grid")}
          className={`p-1.5 sm:p-2 ${
            view === "grid"
              ? "bg-[#F3EDFF] text-black"
              : "text-gray-600 hover:bg-gray-100"
          }`}
          aria-label="Grid view"
          aria-pressed={view === "grid"}
        >
          <Squares2X2Icon className="h-4 w-4 sm:h-5 sm:w-5" />
        </Button>
        {view === "list" && onTogglePermissions && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onTogglePermissions}
            className={`p-1.5 sm:p-2 ${
              showPermissions
                ? "bg-[#F3EDFF] text-black"
                : "text-gray-600 hover:bg-gray-100"
            }`}
            aria-label="Toggle permissions"
            aria-pressed={showPermissions}
            title="Show permissions"
          >
            <ShieldCheckIcon className="h-4 w-4 sm:h-5 sm:w-5" />
          </Button>
        )}
        {actions && <div className="flex items-center gap-1 sm:gap-2">{actions}</div>}
      </nav>
      <div className="text-xs text-gray-600 sm:text-sm" role="status" aria-live="polite">
        {itemCount} {itemCount === 1 ? "item" : "items"}
      </div>
    </header>
  );
}

