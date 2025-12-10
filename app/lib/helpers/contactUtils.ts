import { NamedNode } from "n3";
import { fetchAndParseProfile, extractNameAndEmail, getCachedProfile } from "./profileUtils";
import { getSession, getAuthenticatedSession } from "./sessionUtils";
import { 
  getSolidDataset, 
  getThing, 
  createThing, 
  addUrl, 
  getUrlAll,
  setThing, 
  saveSolidDatasetAt,
  UrlString 
} from "@inrupt/solid-client";

export interface Contact {
    webId: string;
    name: string | null;
    email: string | null;
}

const FOAF_KNOWS = "http://xmlns.com/foaf/0.1/knows";

/**
 * Fetches contacts from the logged-in user's WebID profile using foaf:knows relationships
 * Uses cached profile if available to avoid duplicate fetches
 * @returns Array of contacts with their WebID, name, and email
 */
export async function fetchUserContacts(): Promise<Contact[]> {
    const session = getSession();

    if (!session.info.isLoggedIn || !session.info.webId) {
        return [];
    }

    try {
        const userWebId = session.info.webId;

        // Try to get cached profile first, otherwise fetch it
        let userProfile = getCachedProfile(userWebId);
        if (!userProfile) {
            userProfile = await fetchAndParseProfile(userWebId);
        }

        const { store, mainSubject } = userProfile;

        // Get all foaf:knows relationships
        const knowsQuads = store.getQuads(mainSubject, new NamedNode(FOAF_KNOWS), null, null);

        const contacts: Contact[] = [];

        // For each known person, fetch their profile to get name and email
        for (const quad of knowsQuads) {
            if (quad.object.termType !== "NamedNode") {
                continue;
            }

            const contactWebId = quad.object.value;

            try {
                // Fetch the contact's profile (will use cache if already fetched)
                const { store: contactStore, mainSubject: contactSubject } = await fetchAndParseProfile(contactWebId);

                // Extract name and email using the shared helper
                const { name, email } = extractNameAndEmail(contactStore, contactSubject);

                contacts.push({
                    webId: contactWebId,
                    name,
                    email,
                });
            } catch (error) {
                // If we can't fetch the contact's profile, still add them with just the WebID
                console.warn(`Could not fetch profile for contact ${contactWebId}:`, error);
                contacts.push({
                    webId: contactWebId,
                    name: null,
                    email: null,
                });
            }
        }

        return contacts;
    } catch (error) {
        console.error("Failed to fetch user contacts:", error);
        return [];
    }
}

/**
 * Adds a contact (WebID) to the user's profile using foaf:knows relationship
 * @param contactWebId - The WebID of the contact to add
 * @returns Promise that resolves when the contact is added
 */
export async function addContactToProfile(contactWebId: string): Promise<void> {
    const session = getSession();

    if (!session.info.isLoggedIn || !session.info.webId) {
        throw new Error("User is not logged in");
    }

    const userWebId = session.info.webId;
    const { fetch } = getAuthenticatedSession();
    
    const profileUrl = userWebId.split('#')[0] as UrlString;
    
    try {
        // Fetch the user's profile dataset
        let dataset = await getSolidDataset(profileUrl, { fetch });
        
        // Get the main subject (usually WebID or WebID#me)
        const mainSubject = userWebId as UrlString;
        let thing = getThing(dataset, mainSubject);
        
        // If thing doesn't exist, try with #me fragment
        if (!thing) {
            const meSubject = `${profileUrl}#me` as UrlString;
            thing = getThing(dataset, meSubject);
        }
        
        // If still doesn't exist, create a new thing
        if (!thing) {
            thing = createThing({ url: mainSubject });
        }
        
        // Check if the contact is already in the knows list
        const existingKnows = getUrlAll(thing, FOAF_KNOWS);
        if (existingKnows.includes(contactWebId)) {
            // Contact already exists, no need to add
            return;
        }
        
        // Add the foaf:knows relationship
        thing = addUrl(thing, FOAF_KNOWS, contactWebId as UrlString);
        
        // Update the dataset
        const updatedDataset = setThing(dataset, thing);
        
        // Save the updated dataset
        await saveSolidDatasetAt(profileUrl, updatedDataset, { fetch });
    } catch (error) {
        console.error("Failed to add contact to profile:", error);
        throw error;
    }
}
