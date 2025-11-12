"use client";

import { useState, useEffect, useRef } from "react";
import { useUserProfile } from "../lib/hooks";
import { UserCircleIcon } from "@heroicons/react/24/outline";

export default function ProfileIcon() {
  const [showProfileTooltip, setShowProfileTooltip] = useState(false);
  const { profile } = useUserProfile();
  const tooltipRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const justOpenedRef = useRef(false);

  // Close tooltip when clicking outside on mobile
  useEffect(() => {
    if (!showProfileTooltip) {
      justOpenedRef.current = false;
      return;
    }

    // Mark that tooltip was just opened to prevent immediate closure
    justOpenedRef.current = true;
    const timeoutId = setTimeout(() => {
      justOpenedRef.current = false;
    }, 300);

    const handleClickOutside = (event: Event) => {
      // Ignore clicks that happen immediately after opening
      if (justOpenedRef.current) return;

      const target = event.target as Node;
      if (
        tooltipRef.current &&
        buttonRef.current &&
        !tooltipRef.current.contains(target) &&
        !buttonRef.current.contains(target)
      ) {
        setShowProfileTooltip(false);
      }
    };

    // Add event listener after a delay to avoid immediate closure from the same click
    const listenerTimeoutId = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside, true);
      document.addEventListener("touchstart", handleClickOutside, true);
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      clearTimeout(listenerTimeoutId);
      document.removeEventListener("mousedown", handleClickOutside, true);
      document.removeEventListener("touchstart", handleClickOutside, true);
    };
  }, [showProfileTooltip]);

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setShowProfileTooltip(!showProfileTooltip);
        }}
        onMouseEnter={() => setShowProfileTooltip(true)}
        onMouseLeave={() => setShowProfileTooltip(false)}
        className="cursor-pointer relative flex h-9 w-9 items-center justify-center rounded-full border-2 border-gray-300 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-[#7B42F6] transition-colors overflow-hidden bg-white"
        aria-label="User profile"
        aria-expanded={showProfileTooltip}
      >
        {profile?.photoUrl ? (
          // Use regular img tag for external Solid pod images
          <img
            src={profile.photoUrl}
            alt={profile.name || "Profile"}
            className="h-full w-full rounded-full object-cover"
            onError={(e) => {
              // Hide image on error, show icon as fallback
              e.currentTarget.style.display = 'none';
              const icon = e.currentTarget.parentElement?.querySelector('svg');
              if (icon) icon.style.display = 'block';
            }}
          />
        ) : null}
        {/* Fallback icon - always present but hidden when image is shown */}
        <UserCircleIcon 
          className="h-7 w-7 text-gray-600"
          style={{ display: profile?.photoUrl ? 'none' : 'block' }}
        />
      </button>
      
      {/* Tooltip */}
      {showProfileTooltip && profile && (profile.name || profile.email) && (
        <div
          ref={tooltipRef}
          className="absolute right-0 top-full mt-2 z-[100] w-64 max-w-[calc(100vw-2rem)] rounded-lg bg-gray-900 text-white shadow-lg p-3 sm:right-0"
          role="tooltip"
          onMouseEnter={() => setShowProfileTooltip(true)}
          onMouseLeave={() => setShowProfileTooltip(false)}
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
    </div>
  );
}

