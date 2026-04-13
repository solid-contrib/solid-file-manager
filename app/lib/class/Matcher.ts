import { NamedNodeAs, NamedNodeFrom, SetFrom } from "@rdfjs/wrapper"
import { ACP } from "@/app/lib/class/Vocabulary"
import { Typed } from "@/app/lib/class/Typed"

export class Matcher extends Typed {
    get agent(): Set<string> {
        return SetFrom.subjectPredicate(this, ACP.agent, NamedNodeAs.string, NamedNodeFrom.string)
    }
}
