import { Wrapper, ValueMappings, TermMappings } from "rdfjs-wrapper"
import type { Term, DatasetCore, DataFactory } from "@rdfjs/types"
import { Resource } from "./Resource.js"
import { contains } from "./Vocabulary.js"


export class Container extends Resource {
	private constructor(node: Term, dataset: DatasetCore, factory: DataFactory) {
		super(node, dataset, factory)
	}

	static wrap(wrapper: Wrapper): Container
	static wrap(n: Term, dataset: DatasetCore, factory: DataFactory): Container
	static wrap(nodeOrWrapper: Term | Wrapper, dataset?: DatasetCore, factory?: DataFactory): Container {
		if (dataset !== undefined && factory !== undefined) {
			return new Container(nodeOrWrapper as Term, dataset, factory)
		} else {
			const {term, dataset, factory} = nodeOrWrapper as Wrapper
			return new Container(term, dataset, factory)
		}
	}

	public get contains(): Set<Resource> {
		return this.objects(contains, Resource.wrap2, Resource.wrap2)
	}
}
