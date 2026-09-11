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
      <div className="flex h-14 items-center">
        {/* Desktop: center logo over the w-64 sidebar column */}
        <div className="hidden w-64 shrink-0 items-center justify-center lg:flex">
          <Image
            src="/file-manager-logo.svg"
            alt="Solid File Manager"
            width={48}
            height={48}
            className="h-12 w-12"
            priority
          />
        </div>

        {/* Mobile: menu only — logo lives in the sidebar Sheet */}
        {onMenuClick && (
          <div className="flex items-center px-2 lg:hidden">
            <button
              type="button"
              onClick={onMenuClick}
              className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-md text-muted-foreground hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring"
              aria-label="Toggle menu"
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
        )}

        <div className="ml-auto flex items-center gap-1 px-2 sm:gap-2 sm:px-4">
          <ThemeToggle />
          <ProfileIcon />
        </div>
      </div>
    </header>
  );
}
