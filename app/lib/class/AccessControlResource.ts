import { NamedNodeAs, NamedNodeFrom, OptionalAs, OptionalFrom, SetFrom, TermAs, TermFrom } from "@rdfjs/wrapper"
import { AccessControl } from "@/app/lib/class/AccessControl"
import { ACP } from "@/app/lib/class/Vocabulary"
import { Typed } from "@/app/lib/class/Typed"

export class AccessControlResource extends Typed {
    get accessControl(): Set<AccessControl> {
        return SetFrom.subjectPredicate(this, ACP.accessControl, TermAs.instance(AccessControl), TermFrom.instance)
    }

    get resource(): string | undefined {
        return OptionalFrom.subjectPredicate(this, ACP.resource, NamedNodeAs.string)
    }

    set resource(v: string) {
        OptionalAs.object(this, ACP.resource, v, NamedNodeFrom.string)
    }
}
