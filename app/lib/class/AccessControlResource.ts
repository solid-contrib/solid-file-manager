import { ValueMapping, TermMapping, ObjectMapping } from "rdfjs-wrapper"
import { AccessControl } from "@/app/lib/class/AccessControl"
import { ACP } from "@/app/lib/class/Vocabulary"
import { Typed } from "@/app/lib/class/Typed"

export class AccessControlResource extends Typed {
    get accessControl(): Set<AccessControl> {
        return this.objects(ACP.accessControl, ObjectMapping.as(AccessControl), ObjectMapping.as(AccessControl))
    }

    get resource(): string | undefined {
        return this.singularNullable(ACP.resource, ValueMapping.iriToString)
    }

    set resource(v: string) {
        this.overwriteNullable(ACP.resource, v, TermMapping.stringToIri)
    }
}
