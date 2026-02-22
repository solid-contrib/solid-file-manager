import { TermMapping, ValueMapping, TermWrapper } from "rdfjs-wrapper"
import { RDF } from "@/app/lib/class/Vocabulary"

export class Typed extends TermWrapper {
    get type(): Set<string> {
        return this.objects(RDF.type, ValueMapping.iriToString, TermMapping.stringToIri)
    }
}
