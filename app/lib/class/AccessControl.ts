import { Wrapper } from "rdfjs-wrapper"
import type { DataFactory, DatasetCore, Term } from "@rdfjs/types"
import { Policy } from "@/app/lib/class/Policy"
import { ACP } from "@/app/lib/class/Vocabulary"
import { Typed } from "@/app/lib/class/Typed";

export class AccessControl extends Typed {
    protected constructor(node: Term, dataset: DatasetCore, factory: DataFactory) {
        super(node, dataset, factory)
    }

    static wrap(wrapper: Wrapper): AccessControl
    static wrap(n: Term, dataset: DatasetCore, factory: DataFactory): AccessControl
    static wrap(nodeOrWrapper: Term | Wrapper, dataset?: DatasetCore, factory?: DataFactory): AccessControl {
        if (dataset !== undefined && factory !== undefined) {
            return new AccessControl(nodeOrWrapper as Term, dataset, factory)
        } else {
            const {term, dataset, factory} = nodeOrWrapper as Wrapper
            return new AccessControl(term, dataset, factory)
        }
    }

    public static wrap2(wrapper: Wrapper): AccessControl {
        return AccessControl.wrap(wrapper.term, wrapper.dataset, wrapper.factory)
    }

    get apply(): Set<Policy> {
        return this.objects(ACP.apply, Policy.wrap2, Policy.wrap2)
    }
}
