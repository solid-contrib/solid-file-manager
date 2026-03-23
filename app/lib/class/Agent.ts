import { LiteralAs, NamedNodeAs, NamedNodeFrom, TermAs, TermWrapper } from "@rdfjs/wrapper"
import { FOAF, PIM, SOLID, VCARD } from "@/app/lib/class/Vocabulary"

export class Agent extends TermWrapper {
    get vcardFn(): string | undefined {
        return this.singularNullable(VCARD.fn, LiteralAs.string)
    }

    get vcardHasUrl(): string | undefined {
        return this.singularNullable(VCARD.hasUrl, NamedNodeAs.string)
    }

    get organization(): string | null {
        return this.singularNullable(VCARD.organizationName, NamedNodeAs.string) ?? null
    }

    get role(): string | null {
        return this.singularNullable(VCARD.role, NamedNodeAs.string) ?? null
    }

    get title(): string | null {
        return this.singularNullable(VCARD.title, LiteralAs.string) ?? null
    }

    get phone(): string | null {
        return this.hasTelephone?.actualValue ?? null
    }

    get hasTelephone(): HasValue | undefined {
        return this.singularNullable(VCARD.hasTelephone, TermAs.instance(HasValue))
    }

    get foafName(): string | undefined {
        return this.singularNullable(FOAF.fname, LiteralAs.string)
    }

    get name(): string | null {
        return this.vcardFn ?? this.foafName ?? this.value.split("/").pop()?.split("#")[0] ?? null
    }

    get storageUrls(): Set<string> {
        // TODO: When available - this.pimStorage.union(this.solidStorage)
        return new Set([...this.pimStorage, ...this.solidStorage])
    }

    get foafHomepage(): string | undefined {
        return this.singularNullable(FOAF.homepage, LiteralAs.string)
    }

    get website(): string | null {
        return this.vcardHasUrl ?? this.foafHomepage ?? null
    }

    get photoUrl(): string | null {
        return this.singularNullable(VCARD.hasPhoto, LiteralAs.string) ?? null
    }

    get pimStorage(): Set<string> {
        return this.objects(PIM.storage, NamedNodeAs.string, NamedNodeFrom.string)
    }

    get solidStorage(): Set<string> {
        return this.objects(SOLID.storage, NamedNodeAs.string, NamedNodeFrom.string)
    }

    get email(): string | null {
        return this.hasEmail?.actualValue ?? null
    }

    get hasEmail(): HasValue | undefined {
        return this.singularNullable(VCARD.hasEmail, TermAs.instance(HasValue))
    }

    get knows(): Set<string> {
        return this.objects(FOAF.knows, NamedNodeAs.string, NamedNodeFrom.string)
    }
}

class HasValue extends TermWrapper {
    get actualValue(): string {
        return this.hasValue ?? this.value
    }

    get hasValue(): string | undefined {
        return this.singularNullable(VCARD.hasValue, NamedNodeAs.string)
    }
}
