"use client";

import { useSolidAuth } from "@ldo/solid-react";
import { useUserProfile } from "../lib/hooks";
import { clearContainerCache } from "../lib/cache";
import {
  UserCircle,
  LogOut,
  Phone,
  Building2,
  Briefcase,
  Globe,
  Clipboard,
} from "lucide-react";
import { toast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export default function ProfileIcon() {
  const { session, logout } = useSolidAuth();
  const { profile } = useUserProfile();

  const webId = session.webId || null;

  const handleLogout = async () => {
    try {
      await logout();
      clearContainerCache();
      window.location.href = "/login";
    } catch (error) {
      console.error("Logout failed:", error);
      toast.add({ title: "Failed to sign out", type: "error" });
    }
  };

  const handleCopyWebId = async () => {
    if (!webId) return;

    try {
      await navigator.clipboard.writeText(webId);
      toast.add({ title: "WebID copied to clipboard", type: "success" });
    } catch (error) {
      console.error("Failed to copy WebID:", error);
      toast.add({ title: "Failed to copy WebID", type: "error" });
    }
  };

  const hasProfileData = Boolean(
    profile &&
      (profile.name ||
        profile.email ||
        profile.phone ||
        profile.organization ||
        profile.role ||
        profile.title ||
        profile.website ||
        webId),
  );

  const triggerButton = (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="relative h-9 w-9 rounded-full border-2 border-border hover:border-muted-foreground overflow-hidden bg-background"
      aria-label="User profile"
    >
      {profile?.photoUrl ? (
        // Solid profile photos are often cross-origin; next/image is not suitable here
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={profile.photoUrl}
          alt={profile.name || "Profile"}
          className="h-full w-full rounded-full object-cover"
          onError={(e) => {
            e.currentTarget.style.display = "none";
            const icon = e.currentTarget.parentElement?.querySelector("svg");
            if (icon instanceof HTMLElement) icon.style.display = "block";
          }}
        />
      ) : null}
      <UserCircle
        className="h-7 w-7 text-muted-foreground"
        style={{ display: profile?.photoUrl ? "none" : "block" }}
      />
    </Button>
  );

  if (!hasProfileData) {
    return (
      <Tooltip>
        <TooltipTrigger render={triggerButton} />
        <TooltipContent side="bottom" align="end">
          {profile?.name || "Solid User"}
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger
          render={
            <DropdownMenuTrigger render={triggerButton} />
          }
        />
        <TooltipContent side="bottom" align="end">
          <div className="text-sm font-medium">{profile?.name || "Solid User"}</div>
          {profile?.email ? (
            <div className="text-xs opacity-80">{profile.email}</div>
          ) : null}
        </TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" className="w-80 max-w-[calc(100vw-2rem)] p-0">
        <div className="space-y-2 border-b border-border p-4">
          {profile?.name && (
            <div className="text-base font-medium text-foreground">{profile.name}</div>
          )}
          {profile?.title && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Briefcase className="h-4 w-4" />
              <span>{profile.title}</span>
            </div>
          )}
          {profile?.organization && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Building2 className="h-4 w-4" />
              <span>{profile.organization}</span>
            </div>
          )}
          {profile?.role && (
            <div className="text-sm text-muted-foreground">{profile.role}</div>
          )}
          {profile?.email && (
            <div className="text-sm text-muted-foreground">{profile.email}</div>
          )}
          {profile?.phone && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Phone className="h-4 w-4" />
              <span>{profile.phone}</span>
            </div>
          )}
          {profile?.website && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Globe className="h-4 w-4 shrink-0" />
              <a
                href={profile.website}
                target="_blank"
                rel="noopener noreferrer"
                className="break-all text-primary hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                {profile.website}
              </a>
            </div>
          )}
          {webId && (
            <div className="flex items-start justify-between gap-2 border-t border-border pt-2 text-xs text-muted-foreground break-all">
              <span className="min-w-0 flex-1">{webId}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                className="shrink-0"
                aria-label="Copy WebID"
                onClick={(e) => {
                  e.stopPropagation();
                  void handleCopyWebId();
                }}
              >
                <Clipboard className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
        <div className="p-1">
          <DropdownMenuItem onClick={() => void handleCopyWebId()}>
            <Clipboard />
            Copy WebID
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => void handleLogout()}>
            <LogOut />
            Sign out
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
