import { TermWrapper } from "rdfjs-wrapper"
import { Resource } from "@/app/lib/class/Resource"
import { LDP } from "@/app/lib/class/Vocabulary"

export class Container extends Resource {
    public get contains(): Set<Resource> {
        return this.objects(LDP.contains, TermWrapper.as(Resource), TermWrapper.as(Resource))
    }
}
