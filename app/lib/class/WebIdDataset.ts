import type { DataFactory, DatasetCore } from "@rdfjs/types"
import { Agent } from "@/app/lib/class/Agent"
import { FOAF } from "@/app/lib/class/Vocabulary"

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
        for (const q of this.#dataset.match(undefined, FOAF.primaryTopic)) {
            return Agent.wrap(q.object, this.#dataset, this.#factory);
        }
    }
}
