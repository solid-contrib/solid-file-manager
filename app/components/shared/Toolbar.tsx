"use client";

import { ReactNode } from "react";
import { List, LayoutGrid } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

interface ToolbarProps {
  view: "list" | "grid";
  onViewChange: (view: "list" | "grid") => void;
  itemCount: number;
  actions?: ReactNode;
}

export default function Toolbar({
  view,
  onViewChange,
  itemCount,
  actions,
}: ToolbarProps) {
  return (
    <header className="flex items-center justify-between border-b border-border px-3 py-2.5 sm:px-4">
      <nav className="flex items-center gap-2" aria-label="View options">
        <ToggleGroup
          value={[view]}
          onValueChange={(groupValue) => {
            const next = groupValue[0];
            if (next === "list" || next === "grid") {
              onViewChange(next);
            }
          }}
          variant="outline"
          size="sm"
          spacing={0}
        >
          <ToggleGroupItem value="list" aria-label="List view">
            <List className="size-4" />
          </ToggleGroupItem>
          <ToggleGroupItem value="grid" aria-label="Grid view">
            <LayoutGrid className="size-4" />
          </ToggleGroupItem>
        </ToggleGroup>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </nav>
      <div
        className="text-xs text-muted-foreground sm:text-sm"
        role="status"
        aria-live="polite"
      >
        {itemCount} {itemCount === 1 ? "item" : "items"}
      </div>
    </header>
  );
}
