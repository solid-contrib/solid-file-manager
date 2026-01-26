import { ValueMappings, TermMappings, Wrapper } from "rdfjs-wrapper"
import { AccessControl } from "@/app/lib/class/AccessControl"
import { ACP } from "@/app/lib/class/Vocabulary"
import { Typed } from "@/app/lib/class/Typed"

export class AccessControlResource extends Typed {
    get accessControl(): Set<AccessControl> {
        return this.objects(ACP.accessControl, Wrapper.as(AccessControl), Wrapper.as(AccessControl))
    }

    get resource(): string | undefined {
        return this.singularNullable(ACP.resource, ValueMappings.iriToString)
    }

    set resource(v: string) {
        this.overwriteNullable(ACP.resource, v, TermMappings.stringToIri)
    }
}
