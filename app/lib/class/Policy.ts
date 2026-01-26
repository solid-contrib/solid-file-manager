import {TermMappings, ValueMappings, Wrapper} from "rdfjs-wrapper"
import type { DataFactory, DatasetCore, Term } from "@rdfjs/types"
import { Matcher } from "@/app/lib/class/Matcher"
import { ACP } from "@/app/lib/class/Vocabulary"
import { Typed } from "@/app/lib/class/Typed";

export class Policy extends Typed {
    protected constructor(node: Term, dataset: DatasetCore, factory: DataFactory) {
        super(node, dataset, factory)
    }

    static wrap(wrapper: Wrapper): Policy
    static wrap(n: Term, dataset: DatasetCore, factory: DataFactory): Policy
    static wrap(nodeOrWrapper: Term | Wrapper, dataset?: DatasetCore, factory?: DataFactory): Policy {
        if (dataset !== undefined && factory !== undefined) {
            return new Policy(nodeOrWrapper as Term, dataset, factory)
        } else {
            const {term, dataset, factory} = nodeOrWrapper as Wrapper
            return new Policy(term, dataset, factory)
        }
    }

    public static wrap2(wrapper: Wrapper): Policy {
        return Policy.wrap(wrapper.term, wrapper.dataset, wrapper.factory)
    }

    get allow(): Set<string> {
        return this.objects(ACP.allow, ValueMappings.iriToString, TermMappings.stringToIri)
    }

    get anyOf(): Set<Matcher> {
        return this.objects(ACP.anyOf, Matcher.wrap2, Matcher.wrap2)
    }
}
