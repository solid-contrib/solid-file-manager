import { LiteralAs, NamedNodeAs, NamedNodeFrom, OptionalFrom, SetFrom, TermWrapper } from "@rdfjs/wrapper"
import { DC, POSIX, RDF, RDFS } from "@/app/lib/class/Vocabulary"
import { extractNameFromUrl, FileType } from "@/app/lib/helpers"

export class Resource extends TermWrapper {
    #ianaMediaTypePattern = /^http:\/\/www\.w3\.org\/ns\/iana\/media-types\/(.+)#Resource$/;

    get id(): string {
        return this.value
    }

    get isContainer(): boolean {
        return this.id.endsWith("/")
    }

    get fileType(): FileType {
        return this.isContainer ? "folder" : "file"
    }

    get title(): string | undefined {
        return OptionalFrom.subjectPredicate(this, DC.title, LiteralAs.string)
    }

    get label(): string | undefined {
        return OptionalFrom.subjectPredicate(this, RDFS.label, LiteralAs.string)
    }

    get name(): string {
        return this.title ?? this.label ?? extractNameFromUrl(this.id)
    }

    get modified(): Date | undefined {
        return OptionalFrom.subjectPredicate(this, DC.modified, LiteralAs.date)
    }

    get mtime(): Date | undefined {
        return OptionalFrom.subjectPredicate(this, POSIX.mtime, LiteralAs.date)
    }

    get lastModified(): Date | undefined {
        return this.modified ?? this.mtime
    }

    get size(): number | undefined {
        return OptionalFrom.subjectPredicate(this, POSIX.size, LiteralAs.number)
    }

    get type(): Set<string> {
        return SetFrom.subjectPredicate(this, RDF.type, NamedNodeAs.string, NamedNodeFrom.string)
    }

    get mimeType(): string | undefined {
        const matches = [...this.type]
            .map(t => this.#ianaMediaTypePattern.exec(t))
            .filter(results => results !== null)
            .map(results => results[0])

        for (const match of matches) {
            return match
        }
    }

    toString() {
        return this.id
    }
}
