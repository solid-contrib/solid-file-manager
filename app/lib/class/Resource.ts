import { TermMappings, ValueMappings, Wrapper } from "rdfjs-wrapper"
import { DC, POSIX, RDF, RDFS } from "@/app/lib/class/Vocabulary"
import { extractNameFromUrl, FileType } from "@/app/lib/helpers"

export class Resource extends Wrapper {
    #ianaMediaTypePattern = /^http:\/\/www\.w3\.org\/ns\/iana\/media-types\/(.+)#Resource$/;

    get id(): string {
        return this.term.value
    }

    get isContainer(): boolean {
        return this.id.endsWith("/")
    }

    get fileType(): FileType {
        return this.isContainer ? "folder" : "file"
    }

    get title(): string | undefined {
        return this.singularNullable(DC.title, ValueMappings.literalToString)
    }

    get label(): string | undefined {
        return this.singularNullable(RDFS.label, ValueMappings.literalToString)
    }

    get name(): string {
        return this.title ?? this.label ?? extractNameFromUrl(this.id)
    }

    get modified(): Date | undefined {
        return this.singularNullable(DC.modified, ValueMappings.literalToDate)
    }

    get mtime(): Date | undefined {
        return this.singularNullable(POSIX.mtime, ValueMappings.literalToDate)
    }

    get lastModified(): Date | undefined {
        return this.modified ?? this.mtime
    }

    get size(): number | undefined {
        return this.singularNullable(POSIX.size, ValueMappings.literalToNumber)
    }

    get type(): Set<string> {
        return this.objects(RDF.type, ValueMappings.iriToString, TermMappings.stringToIri)
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
