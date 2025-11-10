"use client";

import { ChevronRightIcon } from "@heroicons/react/24/outline";

interface BreadcrumbItem {
  name: string;
  path: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  onNavigate: (path: string) => void;
}

export default function Breadcrumb({ items, onNavigate }: BreadcrumbProps) {
  // On mobile, show only the last item or truncate
  const displayItems = items.length > 2 ? [items[0], ...items.slice(-2)] : items;

  return (
    <nav className="flex items-center gap-1 overflow-x-auto px-2 py-2 sm:gap-2 sm:px-4" aria-label="Breadcrumb">
      <ol className="flex min-w-0 items-center gap-1 sm:gap-2" role="list">
        {items.length > 2 && (
          <>
            <li className="flex items-center gap-1 sm:gap-2">
              <button
                type="button"
                onClick={() => onNavigate(items[0].path)}
                className="cursor-pointer truncate text-sm text-gray-600 hover:text-black"
              >
                {items[0].name}
              </button>
              <ChevronRightIcon className="h-4 w-4 flex-shrink-0 text-gray-400" />
            </li>
            <li className="text-sm text-gray-400">...</li>
          </>
        )}
        {displayItems.slice(items.length > 2 ? 1 : 0).map((item, index) => {
          const actualIndex = items.length > 2 ? items.length - 2 + index : index;
          return (
            <li key={item.path} className="flex items-center gap-1 sm:gap-2">
              {actualIndex > 0 && (
                <ChevronRightIcon className="h-4 w-4 flex-shrink-0 text-gray-400" />
              )}
              <button
                type="button"
                onClick={() => onNavigate(item.path)}
                className={`cursor-pointer truncate text-sm ${actualIndex === items.length - 1
                    ? "font-medium text-black"
                    : "text-gray-600 hover:text-black"
                  }`}
                aria-current={actualIndex === items.length - 1 ? "page" : undefined}
              >
                {item.name}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

