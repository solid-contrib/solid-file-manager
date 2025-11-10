"use client";

import { useState } from "react";

interface HeaderProps {
  selectedFileCount?: number;
  onShareClick?: () => void;
  onMenuClick?: () => void;
}

export default function Header({ selectedFileCount = 0, onShareClick, onMenuClick }: HeaderProps) {
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <header className="sticky top-0 z-10 border-b border-gray-200 bg-white">
      <div className="flex h-14 items-center gap-2 px-2 sm:gap-4 sm:px-4">
        {/* Menu Button (Mobile) */}
        {onMenuClick && (
          <button
            type="button"
            onClick={onMenuClick}
            className="cursor-pointer flex h-9 w-9 items-center justify-center rounded-md text-gray-600 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500 lg:hidden"
            aria-label="Toggle menu"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>
        )}

        {/* Logo/App Name */}
        <div className="flex items-center gap-2 sm:gap-3">
          <h1 className="text-sm font-medium text-black sm:text-lg">Solid File Manager</h1>
        </div>

        {/* Search Bar */}
        <div className="flex flex-1 items-center">
          <div className="relative w-full max-w-md">
            <input
              type="search"
              placeholder="Search in files"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 w-full rounded-md border border-gray-300 bg-white px-3 pl-9 text-sm text-black placeholder:text-gray-500 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
              aria-label="Search files"
            />
            <svg
              className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1 sm:gap-2">
          {selectedFileCount > 0 && onShareClick && (
            <button
              type="button"
              onClick={onShareClick}
              className="cursor-pointer flex h-9 items-center gap-1 rounded-md bg-purple-600 px-2 text-sm font-medium text-white hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 sm:gap-2 sm:px-3"
              aria-label="Share selected files"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                />
              </svg>
              <span className="hidden sm:inline">Share</span>
            </button>
          )}
          <button
            type="button"
            className="cursor-pointer flex h-9 items-center gap-1 rounded-md border border-gray-300 bg-white px-2 text-sm font-medium text-black hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-purple-500 sm:gap-2 sm:px-3"
            aria-label="New"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            <span className="hidden sm:inline">New</span>
          </button>
        </div>
      </div>
    </header>
  );
}

