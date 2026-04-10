import { NamedNodeAs, NamedNodeFrom, SetFrom, TermAs, TermFrom } from "@rdfjs/wrapper"
import { Matcher } from "@/app/lib/class/Matcher"
import { ACP } from "@/app/lib/class/Vocabulary"
import { Typed } from "@/app/lib/class/Typed"

export class Policy extends Typed {
    get allow(): Set<string> {
        return SetFrom.subjectPredicate(this, ACP.allow, NamedNodeAs.string, NamedNodeFrom.string)
    }

    get anyOf(): Set<Matcher> {
        return SetFrom.subjectPredicate(this, ACP.anyOf, TermAs.instance(Matcher), TermFrom.instance)
    }
}
