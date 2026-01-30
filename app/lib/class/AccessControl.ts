import { TermWrapper } from "rdfjs-wrapper"
import { Policy } from "@/app/lib/class/Policy"
import { ACP } from "@/app/lib/class/Vocabulary"
import { Typed } from "@/app/lib/class/Typed";

export class AccessControl extends Typed {
    get apply(): Set<Policy> {
        return this.objects(ACP.apply, TermWrapper.as(Policy), TermWrapper.as(Policy))
    }
}
