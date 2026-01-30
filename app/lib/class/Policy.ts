import { TermMappings, ValueMappings, TermWrapper } from "rdfjs-wrapper"
import { Matcher } from "@/app/lib/class/Matcher"
import { ACP } from "@/app/lib/class/Vocabulary"
import { Typed } from "@/app/lib/class/Typed"

export class Policy extends Typed {
    get allow(): Set<string> {
        return this.objects(ACP.allow, ValueMappings.iriToString, TermMappings.stringToIri)
    }

    get anyOf(): Set<Matcher> {
        return this.objects(ACP.anyOf, TermWrapper.as(Matcher), TermWrapper.as(Matcher))
    }
}
