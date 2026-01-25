import { TermMappings, ValueMappings, Wrapper } from "rdfjs-wrapper"
import type { DataFactory, DatasetCore, Term } from "@rdfjs/types"
import { ACP } from "@/app/lib/class/Vocabulary"
import { Typed } from "@/app/lib/class/Typed";

export class Matcher extends Typed {
    protected constructor(node: Term, dataset: DatasetCore, factory: DataFactory) {
        super(node, dataset, factory)
    }

    static wrap(wrapper: Wrapper): Matcher
    static wrap(n: Term, dataset: DatasetCore, factory: DataFactory): Matcher
    static wrap(nodeOrWrapper: Term | Wrapper, dataset?: DatasetCore, factory?: DataFactory): Matcher {
        if (dataset !== undefined && factory !== undefined) {
            return new Matcher(nodeOrWrapper as Term, dataset, factory)
        } else {
            const {term, dataset, factory} = nodeOrWrapper as Wrapper
            return new Matcher(term, dataset, factory)
        }
    }

    public static wrap2(wrapper: Wrapper): Matcher {
        return Matcher.wrap(wrapper.term, wrapper.dataset, wrapper.factory)
    }

    get agent(): Set<string> {
        return this.objects(ACP.agent, ValueMappings.iriToString, TermMappings.stringToIri)
    }
}
