import { ValueMappings, TermMappings, Wrapper } from "rdfjs-wrapper"
import { AccessControl } from "@/app/lib/class/AccessControl"
import type { DataFactory, DatasetCore, Term } from "@rdfjs/types"
import { ACP } from "@/app/lib/class/Vocabulary"
import { Typed } from "@/app/lib/class/Typed"

export class AccessControlResource extends Typed {
    protected constructor(node: Term, dataset: DatasetCore, factory: DataFactory) {
        super(node, dataset, factory)
    }

    static wrap(wrapper: Wrapper): AccessControlResource
    static wrap(n: Term, dataset: DatasetCore, factory: DataFactory): AccessControlResource
    static wrap(nodeOrWrapper: Term | Wrapper, dataset?: DatasetCore, factory?: DataFactory): AccessControlResource {
        if (dataset !== undefined && factory !== undefined) {
            return new AccessControlResource(nodeOrWrapper as Term, dataset, factory)
        } else {
            const {term, dataset, factory} = nodeOrWrapper as Wrapper
            return new AccessControlResource(term, dataset, factory)
        }
    }

    get accessControl(): Set<AccessControl> {
        return this.objects(ACP.accessControl, AccessControl.wrap2, AccessControl.wrap2)
    }

    get resource(): string | undefined {
        return this.singularNullable(ACP.resource, ValueMappings.iriToString)
    }

    set resource(v: string) {
        this.overwriteNullable(ACP.resource, v, TermMappings.stringToIri)
    }
}
