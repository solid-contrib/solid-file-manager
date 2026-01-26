import { TermMappings, ValueMappings, Wrapper } from "rdfjs-wrapper"
import { RDF } from "@/app/lib/class/Vocabulary"

export class Typed extends Wrapper {
    get type(): Set<string> {
        return this.objects(RDF.type, ValueMappings.iriToString, TermMappings.stringToIri)
    }
}
