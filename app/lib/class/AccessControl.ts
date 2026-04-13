import { SetFrom, TermAs, TermFrom } from "@rdfjs/wrapper"
import { Policy } from "@/app/lib/class/Policy"
import { ACP } from "@/app/lib/class/Vocabulary"
import { Typed } from "@/app/lib/class/Typed";

export class AccessControl extends Typed {
    get apply(): Set<Policy> {
        return SetFrom.subjectPredicate(this, ACP.apply, TermAs.instance(Policy), TermFrom.instance)
    }
}
