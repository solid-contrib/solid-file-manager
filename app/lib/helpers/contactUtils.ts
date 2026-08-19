import { fetchAndParseProfile } from "./profileUtils";
import { getSession } from "./sessionUtils";

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
    const session = getSession();

    if (!session.info.isLoggedIn || !session.info.webId) {
        return [];
    }

    try {
        const userProfile = await fetchAndParseProfile(session.info.webId);

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
