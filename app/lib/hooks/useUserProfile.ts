"use client";

import { useEffect, useState } from "react";
import { useSolidAuth } from "@ldo/solid-react";
import { fetchAndParseProfile } from "../helpers/profileUtils";

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
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchProfile() {
      try {
        setIsLoading(true);
        setError(null);

        // Wait for authentication to complete
        if (!session.isLoggedIn || !session.webId) {
          setIsLoading(false);
          return;
        }

        const webId = session.webId;

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
  }, [session.isLoggedIn, session.webId]);

  return { profile, isLoading, error };
}

