"use client";

import { useEffect, useState } from "react";
import { getDefaultSession } from "@inrupt/solid-client-authn-browser";
import { Parser, Store, NamedNode, Literal } from "n3";

// vCard predicates
const VCARD_FN = "http://www.w3.org/2006/vcard/ns#fn";
const VCARD_HAS_EMAIL = "http://www.w3.org/2006/vcard/ns#hasEmail";
const VCARD_VALUE = "http://www.w3.org/2006/vcard/ns#value";
const VCARD_HAS_PHOTO = "http://www.w3.org/2006/vcard/ns#hasPhoto";
const VCARD_HAS_TELEPHONE = "http://www.w3.org/2006/vcard/ns#hasTelephone";
const VCARD_ORGANIZATION_NAME = "http://www.w3.org/2006/vcard/ns#organization-name";
const VCARD_ROLE = "http://www.w3.org/2006/vcard/ns#role";
const VCARD_TITLE = "http://www.w3.org/2006/vcard/ns#title";
const VCARD_HAS_URL = "http://www.w3.org/2006/vcard/ns#hasURL";
const FOAF_NAME = "http://xmlns.com/foaf/0.1/name";
const FOAF_HOMEPAGE = "http://xmlns.com/foaf/0.1/homepage";

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
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchProfile() {
      try {
        setIsLoading(true);
        setError(null);

        const session = getDefaultSession();
        
        // Wait for authentication to complete
        if (!session.info.isLoggedIn || !session.info.webId) {
          // Poll for authentication
          const checkInterval = setInterval(() => {
            const currentSession = getDefaultSession();
            if (currentSession.info.isLoggedIn && currentSession.info.webId) {
              clearInterval(checkInterval);
              fetchProfile();
            }
          }, 500);
          
          setTimeout(() => clearInterval(checkInterval), 10000);
          setIsLoading(false);
          return;
        }

        const webId = session.info.webId;

        // Fetch the profile document
        const acceptHeaders = [
          'text/turtle, application/turtle, text/n3, application/n3',
          'text/turtle',
          'application/ld+json',
        ];

        let content: string | null = null;
        let contentType: string = '';

        for (const acceptHeader of acceptHeaders) {
          try {
            const fetchFn = session.fetch || fetch;
            const response = await fetchFn(webId, {
              method: 'GET',
              headers: {
                'Accept': acceptHeader,
              },
            });

            if (response.ok) {
              contentType = response.headers.get('content-type') || '';
              content = await response.text();
              break;
            }
          } catch (err) {
            continue;
          }
        }

        if (!content) {
          throw new Error("Failed to fetch profile document");
        }

        // Parse the RDF content
        const store = new Store();
        if (contentType.includes('text/turtle') || contentType.includes('application/turtle') || 
            contentType.includes('text/n3') || contentType.includes('application/n3')) {
          const parser = new Parser({ baseIRI: webId });
          const quads = parser.parse(content);
          store.addQuads(quads);
        } else {
          // Try parsing as Turtle anyway
          try {
            const parser = new Parser({ baseIRI: webId });
            const quads = parser.parse(content);
            store.addQuads(quads);
          } catch (e) {
            // Silent error handling
          }
        }

        // Find the main subject
        const baseUrl = webId.split('#')[0];
        const subjectVariants = [
          new NamedNode(webId),
          new NamedNode(baseUrl + '#me'),
          new NamedNode('#me'),
          new NamedNode(baseUrl + '#card'),
        ];

        let mainSubject: NamedNode | null = null;
        
        for (const subject of subjectVariants) {
          const nameQuads = store.getQuads(subject, new NamedNode(FOAF_NAME), null, null);
          if (nameQuads.length > 0) {
            mainSubject = subject;
            break;
          }
        }

        // If still not found, try to find Person type
        if (!mainSubject) {
          const personType = new NamedNode('http://xmlns.com/foaf/0.1/Person');
          const personQuads = store.getQuads(null, new NamedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'), personType, null);
          if (personQuads.length > 0 && personQuads[0].subject.termType === 'NamedNode') {
            mainSubject = personQuads[0].subject as NamedNode;
          }
        }

        // Fallback to WebID itself
        if (!mainSubject) {
          mainSubject = new NamedNode(webId);
        }

        // Extract profile information
        let name: string | null = null;
        let email: string | null = null;
        let photoUrl: string | null = null;
        let phone: string | null = null;
        let organization: string | null = null;
        let role: string | null = null;
        let title: string | null = null;
        let website: string | null = null;

        // Get name (try vcard:fn first, then foaf:name)
        const vcardFnQuads = store.getQuads(mainSubject, new NamedNode(VCARD_FN), null, null);
        if (vcardFnQuads.length > 0 && vcardFnQuads[0].object instanceof Literal) {
          name = vcardFnQuads[0].object.value;
        } else {
          const foafNameQuads = store.getQuads(mainSubject, new NamedNode(FOAF_NAME), null, null);
          if (foafNameQuads.length > 0 && foafNameQuads[0].object instanceof Literal) {
            name = foafNameQuads[0].object.value;
          }
        }

        // Get email (vcard:hasEmail -> vcard:value)
        const emailQuads = store.getQuads(mainSubject, new NamedNode(VCARD_HAS_EMAIL), null, null);
        if (emailQuads.length > 0) {
          for (const emailQuad of emailQuads) {
            if (emailQuad.object instanceof NamedNode && emailQuad.object.value.startsWith('mailto:')) {
              email = emailQuad.object.value.replace('mailto:', '');
              break;
            } else {
              const valueQuads = store.getQuads(emailQuad.object, new NamedNode(VCARD_VALUE), null, null);
              if (valueQuads.length > 0) {
                const valueObj = valueQuads[0].object;
                if (valueObj instanceof NamedNode && valueObj.value.startsWith('mailto:')) {
                  email = valueObj.value.replace('mailto:', '');
                  break;
                } else if (valueObj instanceof Literal) {
                  email = valueObj.value.replace('mailto:', '');
                  break;
                }
              }
            }
          }
        }

        // Get phone (vcard:hasTelephone -> vcard:value)
        const phoneQuads = store.getQuads(mainSubject, new NamedNode(VCARD_HAS_TELEPHONE), null, null);
        if (phoneQuads.length > 0) {
          for (const phoneQuad of phoneQuads) {
            if (phoneQuad.object instanceof NamedNode && phoneQuad.object.value.startsWith('tel:')) {
              phone = phoneQuad.object.value.replace('tel:', '');
              break;
            } else {
              const valueQuads = store.getQuads(phoneQuad.object, new NamedNode(VCARD_VALUE), null, null);
              if (valueQuads.length > 0) {
                const valueObj = valueQuads[0].object;
                if (valueObj instanceof NamedNode && valueObj.value.startsWith('tel:')) {
                  phone = valueObj.value.replace('tel:', '');
                  break;
                } else if (valueObj instanceof Literal) {
                  phone = valueObj.value.replace('tel:', '');
                  break;
                }
              }
            }
          }
        }

        // Get organization (vcard:organization-name)
        const orgQuads = store.getQuads(mainSubject, new NamedNode(VCARD_ORGANIZATION_NAME), null, null);
        if (orgQuads.length > 0 && orgQuads[0].object instanceof Literal) {
          organization = orgQuads[0].object.value;
        }

        // Get role (vcard:role)
        const roleQuads = store.getQuads(mainSubject, new NamedNode(VCARD_ROLE), null, null);
        if (roleQuads.length > 0 && roleQuads[0].object instanceof Literal) {
          role = roleQuads[0].object.value;
        }

        // Get title (vcard:title)
        const titleQuads = store.getQuads(mainSubject, new NamedNode(VCARD_TITLE), null, null);
        if (titleQuads.length > 0 && titleQuads[0].object instanceof Literal) {
          title = titleQuads[0].object.value;
        }

        // Get website (vcard:hasURL or foaf:homepage)
        const urlQuads = store.getQuads(mainSubject, new NamedNode(VCARD_HAS_URL), null, null);
        if (urlQuads.length > 0 && urlQuads[0].object instanceof NamedNode) {
          website = urlQuads[0].object.value;
        } else {
          const homepageQuads = store.getQuads(mainSubject, new NamedNode(FOAF_HOMEPAGE), null, null);
          if (homepageQuads.length > 0 && homepageQuads[0].object instanceof NamedNode) {
            website = homepageQuads[0].object.value;
          }
        }

        // Get photo (vcard:hasPhoto)
        const photoQuads = store.getQuads(mainSubject, new NamedNode(VCARD_HAS_PHOTO), null, null);
        if (photoQuads.length > 0 && photoQuads[0].object instanceof NamedNode) {
          photoUrl = photoQuads[0].object.value;
          if (photoUrl && !photoUrl.startsWith('http://') && !photoUrl.startsWith('https://')) {
            try {
              photoUrl = new URL(photoUrl, baseUrl).href;
            } catch (e) {
              // Silent error handling
            }
          }
        }

        // Fallback name from WebID if not found
        if (!name) {
          name = webId.split("/").pop()?.split("#")[0] || null;
        }

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
  }, []);

  return { profile, isLoading, error };
}

