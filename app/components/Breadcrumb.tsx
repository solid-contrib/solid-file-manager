"use client";

import { ChevronRight } from "lucide-react";

interface BreadcrumbItem {
  name: string;
  path: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  onNavigate: (path: string) => void;
}

export default function Breadcrumb({ items, onNavigate }: BreadcrumbProps) {
  return (
    <nav className="flex items-center gap-1 overflow-x-auto px-2 py-2 sm:gap-2 sm:px-4" aria-label="Breadcrumb">
      <ol className="flex min-w-0 items-center gap-1 sm:gap-2" role="list">
        {items.map((item, index) => (
          <li key={`${item.path}-${index}`} className="flex items-center gap-1 sm:gap-2">
            {index > 0 && (
              <ChevronRight className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
            )}
            <button
              type="button"
              onClick={() => onNavigate(item.path)}
              className={`cursor-pointer truncate text-sm ${index === items.length - 1
                  ? "font-medium text-foreground"
                  : "text-muted-foreground hover:text-foreground"
                }`}
              aria-current={index === items.length - 1 ? "page" : undefined}
            >
              {item.name}
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}
