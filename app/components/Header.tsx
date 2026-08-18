"use client";

import { useState } from "react";
import Image from "next/image";
import Input from "./shared/Input";
import ProfileIcon from "./ProfileIcon";
import {
  Bars3Icon,
  MagnifyingGlassIcon,
} from "@heroicons/react/24/outline";

interface HeaderProps {
  onMenuClick?: () => void;
}

export default function Header({ onMenuClick }: HeaderProps) {
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
          <div className="max-w-[250px] max-h-[200px] w-full h-full flex items-center justify-center flex-shrink-0">
            <Image
              src="/file-manager-logo.svg"
              alt="Solid Logo"
              width={24}
              height={24}
              className="w-full h-full object-cover "
              priority
              aria-hidden="true"
            />
          </div>

          {/* Action Buttons */}
          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            <ProfileIcon />
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

