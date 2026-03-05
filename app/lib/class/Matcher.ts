import { TermMapping, ValueMapping } from "rdfjs-wrapper"
import { ACP } from "@/app/lib/class/Vocabulary"
import { Typed } from "@/app/lib/class/Typed"

export class Matcher extends Typed {
    get agent(): Set<string> {
        return this.objects(ACP.agent, ValueMapping.iriToString, TermMapping.stringToIri)
    }
}
