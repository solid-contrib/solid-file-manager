import type { DataFactory, DatasetCore } from "@rdfjs/types"
import { Container } from "@/app/lib/class/Container"
import { LDP } from "@/app/lib/class/Vocabulary"

export class ContainerDataset {
    #dataset: DatasetCore
    #factory: DataFactory

    protected constructor(dataset: DatasetCore, factory: DataFactory) {
        this.#dataset = dataset
        this.#factory = factory
    }

    static wrap(dataset: DatasetCore, factory: DataFactory): ContainerDataset {
        return new ContainerDataset(dataset, factory)
    }

    // TODO: Consider that this might be undefined if there are no contained resources. We might need different matching.
    get container(): Container | undefined {
        // Return the first container in the dataset
        for (const q of this.#dataset.match(undefined, LDP.contains)) {
            return new Container(q.subject, this.#dataset, this.#factory);
        }
    }
}
