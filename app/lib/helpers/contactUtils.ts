import { NamedNode } from "n3";
import { fetchAndParseProfile, extractNameAndEmail, getCachedProfile } from "./profileUtils";
import { getSession } from "./sessionUtils";

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
