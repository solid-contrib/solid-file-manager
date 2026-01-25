import type { DataFactory, DatasetCore } from "@rdfjs/types"
import { AccessControlResource } from "@/app/lib/class/AccessControlResource";
import { ACP, RDF } from "@/app/lib/class/Vocabulary"

export class AcrDataset {
    readonly #dataset: DatasetCore
    readonly #factory: DataFactory

    protected constructor(dataset: DatasetCore, factory: DataFactory) {
        this.#dataset = dataset
        this.#factory = factory
    }

    static wrap(dataset: DatasetCore, factory: DataFactory): AcrDataset {
        return new AcrDataset(dataset, factory)
    }

    get dataset(): DatasetCore {
        return this.#dataset
    }

    get acr(): AccessControlResource | undefined {
        const typeSubjects = [...this.dataset.match(undefined, RDF.type, ACP.AccessControlResource)].map(q => q.subject)
        const resourceSubjects = [...this.dataset.match(undefined, ACP.resource)].map(q => q.subject)
        const accessControlSubjects = [...this.dataset.match(undefined, ACP.accessControl)].map(q => q.subject)
        const memberAccessControlSubjects = [...this.dataset.match(undefined, ACP.memberAccessControl)].map(q => q.subject)
        const subjects = new Set([...typeSubjects, ...resourceSubjects, ...accessControlSubjects, ...memberAccessControlSubjects])

        for (const subject of subjects) {
            return AccessControlResource.wrap(subject, this.#dataset, this.#factory)
        }
    }
}
