import { NamedNodeAs, NamedNodeFrom, TermAs, TermFrom } from "@rdfjs/wrapper"
import { AccessControl } from "@/app/lib/class/AccessControl"
import { ACP } from "@/app/lib/class/Vocabulary"
import { Typed } from "@/app/lib/class/Typed"

export class AccessControlResource extends Typed {
    get accessControl(): Set<AccessControl> {
        return this.objects(ACP.accessControl, TermAs.instance(AccessControl), TermFrom.instance)
    }

    get resource(): string | undefined {
        return this.singularNullable(ACP.resource, NamedNodeAs.string)
    }

    set resource(v: string) {
        this.overwriteNullable(ACP.resource, v, NamedNodeFrom.string)
    }
}
