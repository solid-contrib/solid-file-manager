import { Wrapper } from "rdfjs-wrapper"
import type { Term, DatasetCore, DataFactory } from "@rdfjs/types"

export class Resource extends Wrapper {
	protected constructor(node: Term, dataset: DatasetCore, factory: DataFactory) {
		super(node, dataset, factory)
	}

    static wrap(wrapper: Wrapper): Resource
    static wrap(n: Term, dataset: DatasetCore, factory: DataFactory): Resource
    static wrap(nodeOrWrapper: Term | Wrapper, dataset?: DatasetCore, factory?: DataFactory): Resource {
        if (dataset !== undefined && factory !== undefined) {
            return new Resource(nodeOrWrapper as Term, dataset, factory)
        } else {
            const {term, dataset, factory} = nodeOrWrapper as Wrapper
            return new Resource(term, dataset, factory)
        }
    }

	public static wrap2(node: Wrapper): Resource {
		return Resource.wrap(node.term, node.dataset, node.factory)
	}

	get iri(): string {
		return this.term.value
	}
}
