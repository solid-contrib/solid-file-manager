import { SetFrom, TermAs, TermFrom } from "@rdfjs/wrapper"
import { Resource } from "@/app/lib/class/Resource"
import { LDP } from "@/app/lib/class/Vocabulary"

export class Container extends Resource {
    public get contains(): Set<Resource> {
        return SetFrom.subjectPredicate(this, LDP.contains, TermAs.instance(Resource), TermFrom.instance)
    }
}
