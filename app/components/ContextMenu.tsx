"use client";

import type { ElementType } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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

/** Right-click menu positioned at cursor, built on shadcn DropdownMenu. */
export default function ContextMenu({ position, actions, onClose }: ContextMenuProps) {
  return (
    <DropdownMenu
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            className="fixed size-0 overflow-hidden opacity-0"
            style={{ left: position.x, top: position.y }}
          />
        }
      />
      <DropdownMenuContent
        align="start"
        side="bottom"
        sideOffset={0}
        className="min-w-52 w-auto"
        onContextMenu={(e) => e.preventDefault()}
      >
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <DropdownMenuItem
              key={action.label}
              variant={action.danger ? "destructive" : "default"}
              disabled={action.disabled}
              onClick={() => {
                if (action.disabled) return;
                action.onClick();
              }}
            >
              <Icon />
              {action.label}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
