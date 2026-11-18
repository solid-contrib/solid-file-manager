import { fetchAndParseProfile } from "./profileUtils";

export interface Contact {
    webId: string;
    name: string | null;
    email: string | null;
}

/**
 * Fetches contacts from the logged-in user's WebID profile using foaf:knows relationships
 * Uses cached profile if available to avoid duplicate fetches
 * @param webId - The logged-in user's WebID (none when logged out)
 * @param fetchFn - The fetch to use
 * @returns Array of contacts with their WebID, name, and email
 */
export async function fetchUserContacts(webId: string | undefined, fetchFn: typeof fetch): Promise<Contact[]> {
    if (!webId) {
        return [];
    }

    try {
        const userProfile = await fetchAndParseProfile(webId, fetchFn);

        const contacts: Contact[] = [];

        // For each known person, fetch their profile to get name and email
        for (const contactWebId of userProfile.knows) {
            try {
                // Fetch the contact's profile (will use cache if already fetched)
                const { name, email } = await fetchAndParseProfile(contactWebId, fetchFn);

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
