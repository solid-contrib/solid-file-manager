"use client";

import { useState, useEffect, useRef } from "react";
import { logout } from "@inrupt/solid-client-authn-browser";
import { getSession } from "../lib/helpers";
import { useUserProfile, useClickOutside } from "../lib/hooks";
import { UserCircleIcon, ArrowRightStartOnRectangleIcon, PhoneIcon, BuildingOfficeIcon, BriefcaseIcon, GlobeAltIcon, ClipboardIcon } from "@heroicons/react/24/outline";
import toast from "react-hot-toast";

export default function ProfileIcon() {
  const [showTooltip, setShowTooltip] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const { profile } = useUserProfile();
  const [webId, setWebId] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const session = getSession();
    if (session.info.webId) {
      setWebId(session.info.webId);
    }
  }, []);

  useClickOutside({
    isEnabled: showDropdown,
    onOutsideClick: () => setShowDropdown(false),
    refs: [dropdownRef, buttonRef],
  });

  const handleLogout = async () => {
    try {
      await logout();
      window.location.href = "/";
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const handleCopyWebId = async () => {
    if (!webId) return;

    try {
      await navigator.clipboard.writeText(webId);
      toast.success("WebID copied to clipboard");
    } catch (error) {
      console.error("Failed to copy WebID:", error);
      toast.error("Failed to copy WebID");
    }
  };

  const hasProfileData = profile && (
    profile.name ||
    profile.email ||
    profile.phone ||
    profile.organization ||
    profile.role ||
    profile.title ||
    profile.website
  );

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setShowDropdown(!showDropdown);
          setShowTooltip(false);
        }}
        onMouseEnter={() => {
          if (!showDropdown) {
            setShowTooltip(true);
          }
        }}
        onMouseLeave={() => {
          setShowTooltip(false);
        }}
        className="cursor-pointer relative flex h-9 w-9 items-center justify-center rounded-full border-2 border-gray-300 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-[#7B42F6] transition-colors overflow-hidden bg-white"
        aria-label="User profile"
        aria-expanded={showDropdown}
      >
        {profile?.photoUrl ? (
          <img
            src={profile.photoUrl}
            alt={profile.name || "Profile"}
            className="h-full w-full rounded-full object-cover"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
              const icon = e.currentTarget.parentElement?.querySelector('svg');
              if (icon) icon.style.display = 'block';
            }}
          />
        ) : null}
        <UserCircleIcon
          className="h-7 w-7 text-gray-600"
          style={{ display: profile?.photoUrl ? 'none' : 'block' }}
        />
      </button>

      {/* Hover tooltip - shows only name and email */}
      {showTooltip && !showDropdown && profile && (profile.name || profile.email) && (
        <div
          ref={tooltipRef}
          className="absolute right-0 top-full mt-2 z-[100] w-64 max-w-[calc(100vw-2rem)] rounded-lg bg-gray-900 text-white shadow-lg p-3 sm:right-0"
          role="tooltip"
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="text-sm font-medium mb-1">
            {profile.name || "Solid User"}
          </div>
          {profile.email && (
            <div className="text-xs text-gray-300">{profile.email}</div>
          )}
        </div>
      )}

      {/* Click dropdown - shows all profile details */}
      {showDropdown && hasProfileData && (
        <div
          ref={dropdownRef}
          className="absolute right-0 top-full mt-2 z-[100] w-80 max-w-[calc(100vw-2rem)] rounded-lg bg-white border border-gray-200 shadow-lg overflow-hidden sm:right-0"
          role="menu"
          onMouseEnter={() => setShowDropdown(true)}
          onMouseLeave={() => setShowDropdown(false)}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-4 border-b border-gray-200 space-y-2">
            {profile?.name && (
              <div className="text-base font-medium text-gray-900">
                {profile.name}
              </div>
            )}

            {profile?.title && (
              <div className="text-sm text-gray-600 flex items-center gap-2">
                <BriefcaseIcon className="h-4 w-4 text-gray-400" />
                <span>{profile.title}</span>
              </div>
            )}

            {profile?.organization && (
              <div className="text-sm text-gray-600 flex items-center gap-2">
                <BuildingOfficeIcon className="h-4 w-4 text-gray-400" />
                <span>{profile.organization}</span>
              </div>
            )}

            {profile?.role && (
              <div className="text-sm text-gray-600">
                {profile.role}
              </div>
            )}

            {profile?.email && (
              <div className="text-sm text-gray-600">
                {profile.email}
              </div>
            )}

            {profile?.phone && (
              <div className="text-sm text-gray-600 flex items-center gap-2">
                <PhoneIcon className="h-4 w-4 text-gray-400" />
                <span>{profile.phone}</span>
              </div>
            )}

            {profile?.website && (
              <div className="text-sm text-gray-600 flex items-center gap-2">
                <GlobeAltIcon className="h-4 w-4 text-gray-400" />
                <a
                  href={profile.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 hover:underline break-all"
                  onClick={(e) => e.stopPropagation()}
                >
                  {profile.website}
                </a>
              </div>
            )}

            {webId && (
              <div className="text-xs text-gray-500 break-all pt-2 border-t border-gray-100 flex items-center justify-between gap-2">
                <span className="flex-1 min-w-0">{webId}</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCopyWebId();
                  }}
                  className="flex-shrink-0 p-1 rounded hover:bg-gray-100 transition-colors cursor-pointer"
                  aria-label="Copy WebID"
                  title="Copy WebID"
                >
                  <ClipboardIcon className="h-4 w-4 text-gray-400 hover:text-gray-600" />
                </button>
              </div>
            )}
          </div>

          <div className="p-2">
            <button
              type="button"
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
              role="menuitem"
            >
              <ArrowRightStartOnRectangleIcon className="h-5 w-5 text-gray-500" />
              <span>Sign out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

