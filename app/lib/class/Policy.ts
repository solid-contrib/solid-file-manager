import { NamedNodeAs, NamedNodeFrom, TermAs, TermFrom } from "@rdfjs/wrapper"
import { Matcher } from "@/app/lib/class/Matcher"
import { ACP } from "@/app/lib/class/Vocabulary"
import { Typed } from "@/app/lib/class/Typed"

export class Policy extends Typed {
    get allow(): Set<string> {
        return this.objects(ACP.allow, NamedNodeAs.string, NamedNodeFrom.string)
    }

    get anyOf(): Set<Matcher> {
        return this.objects(ACP.anyOf, TermAs.instance(Matcher), TermFrom.instance)
    }
}
