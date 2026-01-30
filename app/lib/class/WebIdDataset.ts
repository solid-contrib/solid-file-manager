import { DatasetWrapper } from "rdfjs-wrapper"
import { Agent } from "@/app/lib/class/Agent"
import { SOLID } from "@/app/lib/class/Vocabulary"

export class WebIdDataset extends DatasetWrapper{
    get mainSubject(): Agent | undefined {
        // TODO: Fix with FOAF: Primary topic either via Inrupt or spec because this does not work with Inrupt WebID
        // TODO: do the isPrimaryTopicOf route and the primaryTopic (maybe)
        // Or not because all WebIDs will have an issuer (otherwise also needs to restrict to the document URL as subject or object to realise the benefit)
        for (const s of this.subjectsOf(Agent, SOLID.oidcIssuer)) {
            return s;
        }
    }
}
