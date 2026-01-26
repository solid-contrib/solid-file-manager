import { TermMappings, ValueMappings, Wrapper } from "rdfjs-wrapper"
import { FOAF, PIM, SOLID, VCARD } from "@/app/lib/class/Vocabulary"

export class Agent extends Wrapper {
    get vcardFn(): string | undefined {
        return this.singularNullable(VCARD.fn, ValueMappings.literalToString)
    }

    get vcardHasUrl(): string | undefined {
        return this.singularNullable(VCARD.hasUrl, ValueMappings.iriToString)
    }

    get organization(): string | null {
        return this.singularNullable(VCARD.organizationName, ValueMappings.iriToString) ?? null
    }

    get role(): string | null {
        return this.singularNullable(VCARD.role, ValueMappings.iriToString) ?? null
    }

    get title(): string | null {
        return this.singularNullable(VCARD.title, ValueMappings.literalToString) ?? null
    }

    get phone(): string | null {
        return this.hasTelephone?.value ?? null
    }

    get hasTelephone(): HasValue | undefined {
        return this.singularNullable(VCARD.hasTelephone, Wrapper.as(HasValue))
    }

    get foafName(): string | undefined {
        return this.singularNullable(FOAF.fname, ValueMappings.literalToString)
    }

    get name(): string | null {
        return this.vcardFn ?? this.foafName ?? this.term.value.split("/").pop()?.split("#")[0] ?? null
    }

    get storageUrls(): Set<string> {
        // TODO: When available - this.pimStorage.union(this.solidStorage)
        return new Set([...this.pimStorage, ...this.solidStorage])
    }

    get foafHomepage(): string | undefined {
        return this.singularNullable(FOAF.homepage, ValueMappings.literalToString)
    }

    get website(): string | null {
        return this.vcardHasUrl ?? this.foafHomepage ?? null
    }

    get photoUrl(): string | null {
        return this.singularNullable(VCARD.hasPhoto, ValueMappings.literalToString) ?? null
    }

    get pimStorage(): Set<string> {
        return this.objects(PIM.storage, ValueMappings.iriToString, TermMappings.stringToIri)
    }

    get solidStorage(): Set<string> {
        return this.objects(SOLID.storage, ValueMappings.iriToString, TermMappings.stringToIri)
    }

    get email(): string | null {
        return this.hasEmail?.value ?? null
    }

    get hasEmail(): HasValue | undefined {
        return this.singularNullable(VCARD.hasEmail, Wrapper.as(HasValue))
    }

    get knows(): Set<string> {
        return this.objects(FOAF.knows, ValueMappings.iriToString, TermMappings.stringToIri)
    }
}

class HasValue extends Wrapper {
    get value(): string {
        return this.hasValue ?? this.term.value
    }

    get hasValue(): string | undefined {
        return this.singularNullable(VCARD.hasValue, ValueMappings.iriToString)
    }
}
