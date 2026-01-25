import { TermMappings, ValueMappings, Wrapper } from "rdfjs-wrapper"
import type { DataFactory, DatasetCore, Term } from "@rdfjs/types"
import { RDF } from "@/app/lib/class/Vocabulary"

export class Typed extends Wrapper {
    protected constructor(node: Term, dataset: DatasetCore, factory: DataFactory) {
        super(node, dataset, factory)
    }

    static wrap(wrapper: Wrapper): Typed
    static wrap(n: Term, dataset: DatasetCore, factory: DataFactory): Typed
    static wrap(nodeOrWrapper: Term | Wrapper, dataset?: DatasetCore, factory?: DataFactory): Typed {
        if (dataset !== undefined && factory !== undefined) {
            return new Typed(nodeOrWrapper as Term, dataset, factory)
        } else {
            const {term, dataset, factory} = nodeOrWrapper as Wrapper
            return new Typed(term, dataset, factory)
        }
    }

    get type(): Set<string> {
        return this.objects(RDF.type, ValueMappings.iriToString, TermMappings.stringToIri)
    }
}
