"use client";

import Image from "next/image";
import ProfileIcon from "./ProfileIcon";
import ThemeToggle from "./ThemeToggle";
import { Menu } from "lucide-react";

interface HeaderProps {
  onMenuClick?: () => void;
  sidebarOpen?: boolean;
}

export default function Header({ onMenuClick }: HeaderProps) {
  return (
    <header className="sticky top-0 z-10 border-b border-border bg-background">
      <div className="flex h-14 items-center gap-2 px-2 sm:gap-4 sm:px-4">
        {onMenuClick && (
          <button
            type="button"
            onClick={onMenuClick}
            className="cursor-pointer flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring lg:hidden"
            aria-label="Toggle menu"
          >
            <Menu className="h-5 w-5" />
          </button>
        )}

        <div className="flex h-full max-h-[200px] max-w-[250px] flex-shrink-0 items-center justify-center">
          <Image
            src="/file-manager-logo.svg"
            alt="Solid Logo"
            width={24}
            height={24}
            className="h-full w-full object-cover"
            priority
            aria-hidden="true"
          />
        </div>

        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <ThemeToggle />
          <ProfileIcon />
        </div>
      </div>
    </header>
  );
}
