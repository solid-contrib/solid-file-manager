import type { DataFactory, DatasetCore } from "@rdfjs/types"
import { Container } from "./Container.js"
import { contains } from "./Vocabulary.js"

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

    get container(): Container | undefined {
        // Return the first container in the dataset
        for (const term of this.#dataset.match(undefined, contains)) {
            return Container.wrap(term, this.#dataset, this.#factory);
        }
    }
}
