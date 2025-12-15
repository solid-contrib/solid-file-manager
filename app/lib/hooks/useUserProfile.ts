"use client";

import { useMemo } from "react";
import { useSolidAuth, useResource, useSubject } from "@ldo/solid-react";
import { SolidProfileShapeType, extractNameAndEmail, getPhotoUrl, getWebsiteUrl, getPhone, getDisplayName } from "../helpers/profileUtils";

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
 * Hook to fetch user profile information from WebID using LDO's useResource and useSubject
 */
export function useUserProfile(): UseUserProfileResult {
  const { session } = useSolidAuth();
  const webId = session.webId;
  
  // useResource handles fetching automatically
  const resource = useResource(webId);
  
  // useSubject extracts typed data from the resource
  const solidProfile = useSubject(SolidProfileShapeType, webId);
  
  // Check if resource is still loading (handle different resource types)
  const resourceIsLoading = resource ? (
    'isReading' in resource ? resource.isReading() : 
    'isUnfetched' in resource ? resource.isUnfetched() : 
    false
  ) : !session.isLoggedIn;

  const profile = useMemo<UserProfile | null>(() => {
    if (!webId || !solidProfile) {
      return null;
    }

    const baseUrl = webId.split('#')[0];

    // Extract profile information using helper functions
    const { name: extractedName, email } = extractNameAndEmail(solidProfile);
    const photoUrl = getPhotoUrl(solidProfile, baseUrl);
    const website = getWebsiteUrl(solidProfile);
    const phone = getPhone(solidProfile);

    // Get organization, role, title directly from the profile
    const organization = solidProfile.organizationName || null;
    const role = solidProfile.role || null;
    const title = solidProfile.title || null;

    // Use getDisplayName for fallback name handling
    const name = getDisplayName(solidProfile, webId);

    return {
      name,
      email,
      photoUrl,
      phone,
      organization,
      role,
      title,
      website,
    };
  }, [webId, solidProfile]);

  // Determine loading state from resource
  const isLoading = resourceIsLoading;
  
  // Determine error state from resource
  const error = useMemo(() => {
    if (resource && 'isError' in resource && resource.isError) {
      return new Error("Failed to fetch user profile");
    }
    return null;
  }, [resource]);

  return { profile, isLoading, error };
}

