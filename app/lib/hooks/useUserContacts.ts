"use client";

import { useMemo, useState, useEffect } from "react";
import { useSolidAuth, useResource, useSubject } from "@ldo/solid-react";
import { parseRdf } from "@ldo/ldo";
import { SolidProfileShapeType, getContactWebIds, extractNameAndEmail } from "../helpers/profileUtils";

export interface Contact {
  webId: string;
  name: string | null;
  email: string | null;
}

interface UseUserContactsResult {
  contacts: Contact[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * Hook to fetch user contacts from WebID profile's foaf:knows relationships
 * Uses LDO's useResource and useSubject for the user's profile, then fetches each contact
 */
export function useUserContacts(): UseUserContactsResult {
  const { session } = useSolidAuth();
  const webId = session.webId;
  
  // Fetch the user's profile using LDO hooks
  const resource = useResource(webId);
  const profile = useSubject(SolidProfileShapeType, webId);
  
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [contactsError, setContactsError] = useState<Error | null>(null);
  const [refetchTrigger, setRefetchTrigger] = useState(0);
  
  // Check if resource is still loading (handle different resource types)
  const resourceIsLoading = resource ? (
    'isReading' in resource ? resource.isReading() : 
    'isUnfetched' in resource ? resource.isUnfetched() : 
    false
  ) : true;
  
  // Get contact WebIDs from the user's profile
  const contactWebIds = useMemo(() => {
    if (!profile) return [];
    return getContactWebIds(profile);
  }, [profile]);
  
  // Fetch each contact's profile
  useEffect(() => {
    let isMounted = true;
    
    async function fetchContactProfiles() {
      if (contactWebIds.length === 0) {
        setContacts([]);
        return;
      }
      
      setContactsLoading(true);
      setContactsError(null);
      
      const fetchedContacts: Contact[] = [];
      
      // Get fetch function from session
      const fetchFn = ('fetch' in session && typeof (session as any).fetch === 'function')
        ? (session as any).fetch
        : fetch;
      
      for (const contactWebId of contactWebIds) {
        try {
          // Fetch the contact's profile document
          const response = await fetchFn(contactWebId, {
            method: 'GET',
            headers: {
              'Accept': 'text/turtle, application/turtle, text/n3',
            },
          });
          
          if (!response.ok) {
            // Add contact with just WebID if fetch fails
            fetchedContacts.push({
              webId: contactWebId,
              name: null,
              email: null,
            });
            continue;
          }
          
          const content = await response.text();
          const baseUrl = contactWebId.split('#')[0];
          
          // Parse using LDO
          const ldoDataset = await parseRdf(content, {
            baseIRI: baseUrl,
            format: "Turtle",
          });
          
          // Get the contact's profile
          const contactProfile = ldoDataset.usingType(SolidProfileShapeType).fromSubject(contactWebId);
          
          // Extract name and email
          const { name, email } = extractNameAndEmail(contactProfile);
          
          fetchedContacts.push({
            webId: contactWebId,
            name,
            email,
          });
        } catch (error) {
          console.warn(`Could not fetch profile for contact ${contactWebId}:`, error);
          fetchedContacts.push({
            webId: contactWebId,
            name: null,
            email: null,
          });
        }
      }
      
      if (isMounted) {
        setContacts(fetchedContacts);
        setContactsLoading(false);
      }
    }
    
    // Only fetch contacts once the profile is loaded
    if (!resourceIsLoading && session.isLoggedIn) {
      fetchContactProfiles();
    }
    
    return () => {
      isMounted = false;
    };
  }, [contactWebIds, session, resourceIsLoading, refetchTrigger]);
  
  // Determine overall loading state
  const isLoading = !session.isLoggedIn 
    ? false 
    : resourceIsLoading || contactsLoading;
  
  // Determine error state
  const error = useMemo(() => {
    if (resource && 'isError' in resource && resource.isError) {
      return new Error("Failed to fetch user profile for contacts");
    }
    return contactsError;
  }, [resource, contactsError]);
  
  // Refetch function to manually trigger a refresh
  const refetch = () => {
    setRefetchTrigger(prev => prev + 1);
  };
  
  return { contacts, isLoading, error, refetch };
}
