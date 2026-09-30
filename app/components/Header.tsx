"use client";

import ProfileIcon from "./ProfileIcon";
import ThemeToggle from "./ThemeToggle";
import { SidebarTrigger } from "@/components/ui/sidebar";

export default function Header() {
  return (
    <header className="sticky top-0 z-10 flex h-14 items-center gap-2 border-b border-border bg-background px-2 sm:px-4">
      <SidebarTrigger className="lg:hidden" />
      <div className="ml-auto flex items-center gap-1 sm:gap-2">
        <ThemeToggle />
        <ProfileIcon />
      </div>
    </header>
  );
}
