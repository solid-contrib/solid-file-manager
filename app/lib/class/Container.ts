import { Wrapper } from "rdfjs-wrapper"
import type { DataFactory, DatasetCore, Term } from "@rdfjs/types"
import { Resource } from "@/app/lib/class/Resource"
import { LDP } from "@/app/lib/class/Vocabulary"

export class Container extends Resource {
    protected constructor(node: Term, dataset: DatasetCore, factory: DataFactory) {
        super(node, dataset, factory)
    }

    static wrap(wrapper: Wrapper): Container
    static wrap(term: Term, dataset: DatasetCore, factory: DataFactory): Container
    static wrap(termOrWrapper: Term | Wrapper, dataset?: DatasetCore, factory?: DataFactory): Container {
        if (dataset !== undefined && factory !== undefined) {
            return new Container(termOrWrapper as Term, dataset, factory)
        } else {
            const {term, dataset, factory} = termOrWrapper as Wrapper
            return new Container(term, dataset, factory)
        }
    }

    public get contains(): Set<Resource> {
        return this.objects(LDP.contains, Resource.wrap2, Resource.wrap2)
    }
}
