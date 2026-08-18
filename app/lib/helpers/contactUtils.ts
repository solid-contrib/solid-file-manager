import { fetchAndParseProfile } from "./profileUtils";
import { getAuthFetch, getCurrentSession } from "../auth/manager";
import { fromRdfJsDataset, saveSolidDatasetAt } from "@inrupt/solid-client";


export interface Contact {
    webId: string;
    name: string | null;
    email: string | null;
}

/**
 * Fetches contacts from the logged-in user's WebID profile using foaf:knows relationships
 * Uses cached profile if available to avoid duplicate fetches
 * @returns Array of contacts with their WebID, name, and email
 */
export async function fetchUserContacts(): Promise<Contact[]> {
    const session = getCurrentSession();

    if (!session) {
        return [];
    }

    try {
        const userWebId = session.webId;
        if (!userWebId) {
            return [];
        }

        const userProfile = await fetchAndParseProfile(userWebId);

        const contacts: Contact[] = [];

        // For each known person, fetch their profile to get name and email
        for (const contactWebId of userProfile.knows) {
            try {
                // Fetch the contact's profile (will use cache if already fetched)
                const { name, email } = await fetchAndParseProfile(contactWebId);

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
    const session = getCurrentSession();

    if (!session) {
        throw new Error("User is not logged in");
    }

    const userWebId = session.webId;
    if (!userWebId) {
        throw new Error("User WebID is not available");
    }
    const fetch = getAuthFetch();

    const profileUrl = userWebId.split('#')[0];

    try {
        // Fetch the user's profile dataset
        // Get the main subject (usually WebID or WebID#me)
        const mainSubject = await fetchAndParseProfile(profileUrl);
        
        // Add the foaf:knows relationship
        mainSubject.knows.add(contactWebId);

        // Save the updated dataset
        await saveSolidDatasetAt(profileUrl, fromRdfJsDataset(mainSubject.dataset), { fetch });
    } catch (error) {
        console.error("Failed to add contact to profile:", error);
        throw error;
    }
}
