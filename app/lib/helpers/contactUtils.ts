import { parseRdf, toTurtle } from "@ldo/ldo";
import { getSession, getAuthenticatedSession } from "./sessionUtils";
import { SolidProfileShapeType } from "../../../src/ldo/Profile.shapeTypes";

export interface Contact {
    webId: string;
    name: string | null;
    email: string | null;
}

const FOAF_KNOWS = "http://xmlns.com/foaf/0.1/knows";

// NOTE: fetchUserContacts has been replaced by the useUserContacts hook
// located at app/lib/hooks/useUserContacts.ts

/**
 * Adds a contact (WebID) to the user's profile using foaf:knows relationship
 * Uses LDO for parsing and serializing RDF data
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
    
    const profileUrl = userWebId.split('#')[0];
    
    try {
        // Fetch the user's profile
        const response = await fetch(profileUrl, {
            headers: {
                'Accept': 'text/turtle',
            },
        });
        
        if (!response.ok) {
            throw new Error(`Failed to fetch profile: ${response.statusText}`);
        }
        
        const content = await response.text();
        
        // Parse profile with LDO
        const ldoDataset = await parseRdf(content, {
            baseIRI: profileUrl,
            format: "Turtle",
        });
        
        // Get the profile subject (could be WebID or WebID#me)
        let profile = ldoDataset
            .usingType(SolidProfileShapeType)
            .fromSubject(userWebId);
        
        // Check if contact already exists
        const existingContacts = profile.knows ? [...profile.knows] : [];
        const contactExists = existingContacts.some(c => c["@id"] === contactWebId);
        
        if (contactExists) {
            // Contact already exists, no need to add
            return;
        }
        
        // Add the contact using foaf:knows
        if (!profile.knows) {
            // Initialize the knows set if it doesn't exist
            profile = ldoDataset
                .usingType(SolidProfileShapeType)
                .fromSubject(userWebId);
        }
        
        profile.knows?.add({ "@id": contactWebId });
        
        // Serialize to Turtle
        const updatedTurtle = toTurtle(profile);
        
        // Use PATCH to update the profile
        // Build SPARQL UPDATE to add the triple
        const sparqlUpdate = `
            PREFIX foaf: <http://xmlns.com/foaf/0.1/>
            INSERT DATA {
                <${userWebId}> foaf:knows <${contactWebId}> .
            }
        `;
        
        const patchResponse = await fetch(profileUrl, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/sparql-update',
            },
            body: sparqlUpdate,
        });
        
        if (!patchResponse.ok) {
            throw new Error(`Failed to update profile: ${patchResponse.statusText}`);
        }
    } catch (error) {
        console.error("Failed to add contact to profile:", error);
        throw error;
    }
}
