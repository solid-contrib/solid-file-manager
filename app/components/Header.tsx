"use client";

import { useState } from "react";
import Image from "next/image";
import Button from "./shared/Button";
import Input from "./shared/Input";
import {
  Bars3Icon,
  MagnifyingGlassIcon,
  ShareIcon,
  PlusIcon,
} from "@heroicons/react/24/outline";

interface HeaderProps {
  selectedFileCount?: number;
  onShareClick?: () => void;
  onMenuClick?: () => void;
}

export default function Header({ selectedFileCount = 0, onShareClick, onMenuClick }: HeaderProps) {
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <header className="sticky top-0 z-10 border-b border-gray-200 bg-white">
      <div className="relative flex flex-col gap-2 px-2 py-2 sm:flex-row sm:items-center sm:gap-4 sm:px-4 sm:py-0 sm:h-14">
        {/* Top Row: Menu, Logo, Actions */}
        <div className="flex h-14 w-full items-center gap-2 sm:gap-4">
          {/* Menu Button (Mobile) */}
          {onMenuClick && (
            <button
              type="button"
              onClick={onMenuClick}
              className="cursor-pointer flex h-9 w-9 items-center justify-center rounded-md text-gray-600 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-[#7B42F6] lg:hidden"
              aria-label="Toggle menu"
            >
              <Bars3Icon className="h-5 w-5" />
            </button>
          )}

          {/* Logo/App Name */}
          <div className="flex items-center gap-2 sm:gap-3">
            <Image
              src="/solid.svg"
              alt="Solid Logo"
              width={24}
              height={24}
              className="h-6 w-6 flex-shrink-0 sm:h-7 sm:w-7"
              priority
              aria-hidden="true"
            />
            <h1 className="text-sm font-medium text-black sm:text-lg">Solid File Manager</h1>
          </div>

          {/* Action Buttons */}
          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            {selectedFileCount > 0 && onShareClick && (
              <Button
                variant="primary"
                size="sm"
                onClick={onShareClick}
                className="flex h-9 items-center gap-1 sm:gap-2 sm:px-3"
                aria-label="Share selected files"
              >
                <ShareIcon className="h-4 w-4" />
                <span className="hidden sm:inline">Share</span>
              </Button>
            )}
            <Button
              variant="secondary"
              size="sm"
              className="flex h-9 items-center gap-1 sm:gap-2 sm:px-3"
              aria-label="New"
            >
              <PlusIcon className="h-4 w-4" />
              <span className="hidden sm:inline">New</span>
            </Button>
          </div>
        </div>

        {/* Search Bar - Full width on mobile, centered on desktop */}
        <div className="flex items-center sm:absolute sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-xl">
          <Input
            type="search"
            placeholder="Search in files"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            leftIcon={<MagnifyingGlassIcon className="h-4 w-4" />}
            aria-label="Search files"
            className="w-full"
          />
        </div>
      </div>
    </header>
  );
}

