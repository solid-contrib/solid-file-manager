import type { DataFactory, DatasetCore } from "@rdfjs/types"
import { Agent } from "@/app/lib/class/Agent"
import { SOLID } from "@/app/lib/class/Vocabulary"

export class WebIdDataset {
    #dataset: DatasetCore
    #factory: DataFactory

    protected constructor(dataset: DatasetCore, factory: DataFactory) {
        this.#dataset = dataset
        this.#factory = factory
    }

    static wrap(dataset: DatasetCore, factory: DataFactory): WebIdDataset {
        return new WebIdDataset(dataset, factory)
    }

    get mainSubject(): Agent | undefined {
        // TODO: Fix with FOAF: Primary topic either via Inrupt or spec because this does not work with Inrupt WebID
        // TODO: do the isPrimaryTopicOf route and the primaryTopic (maybe)
        // Or not because all WebIDs will have an issuer (otherwise also needs to restrict to the document URL as subject or object to realise the benefit)
        for (const q of this.#dataset.match(undefined, SOLID.oidcIssuer)) {
            return new Agent(q.subject, this.#dataset, this.#factory);
        }
    }
}
