import { NamedNodeAs, NamedNodeFrom, SetFrom, TermWrapper } from "@rdfjs/wrapper"
import { RDF } from "@/app/lib/class/Vocabulary"

export class Typed extends TermWrapper {
    get type(): Set<string> {
        return SetFrom.subjectPredicate(this, RDF.type, NamedNodeAs.string, NamedNodeFrom.string)
    }
}
