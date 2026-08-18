"use client";

import { useEffect, useState } from "react";
import { fetchAndParseProfile } from "../helpers/profileUtils";
import { useSolidAuth } from "./useSolidAuth";

export interface UserProfile {
  name: string | null;
  email: string | null;
  photoUrl: string | null;
  phone: string | null;
  organization: string | null;
  role: string | null;
  title: string | null;
  website: string | null;
}

interface UseUserProfileResult {
  profile: UserProfile | null;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Hook to fetch user profile information from WebID
 */
export function useUserProfile(): UseUserProfileResult {
  const { session } = useSolidAuth();
  const { isLoggedIn, webId } = session;
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchProfile() {
      try {
        setIsLoading(true);
        setError(null);

        // Wait for authentication to complete
        if (!isLoggedIn || !webId) {
          setIsLoading(false);
          return;
        }

        // Use shared profile fetching utility (with caching)
        const { name, email, photoUrl, phone, organization, role, title, website } = await fetchAndParseProfile(webId);

        const profileData: UserProfile = {
          name,
          email,
          photoUrl,
          phone,
          organization,
          role,
          title,
          website,
        };

        setProfile(profileData);
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err : new Error("Failed to fetch user profile");
        setError(errorMessage);
        setProfile(null);
      } finally {
        setIsLoading(false);
      }
    }

    fetchProfile();
  }, [isLoggedIn, webId]);

  return { profile, isLoading, error };
}

