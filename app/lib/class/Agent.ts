import { TermMapping, ValueMapping, TermWrapper, ObjectMapping } from "rdfjs-wrapper"
import { FOAF, PIM, SOLID, VCARD } from "@/app/lib/class/Vocabulary"

export class Agent extends TermWrapper {
    get vcardFn(): string | undefined {
        return this.singularNullable(VCARD.fn, ValueMapping.literalToString)
    }

    get vcardHasUrl(): string | undefined {
        return this.singularNullable(VCARD.hasUrl, ValueMapping.iriToString)
    }

    get organization(): string | null {
        return this.singularNullable(VCARD.organizationName, ValueMapping.iriToString) ?? null
    }

    get role(): string | null {
        return this.singularNullable(VCARD.role, ValueMapping.iriToString) ?? null
    }

    get title(): string | null {
        return this.singularNullable(VCARD.title, ValueMapping.literalToString) ?? null
    }

    get phone(): string | null {
        return this.hasTelephone?.actualValue ?? null
    }

    get hasTelephone(): HasValue | undefined {
        return this.singularNullable(VCARD.hasTelephone, ObjectMapping.as(HasValue))
    }

    get foafName(): string | undefined {
        return this.singularNullable(FOAF.fname, ValueMapping.literalToString)
    }

    get name(): string | null {
        return this.vcardFn ?? this.foafName ?? this.value.split("/").pop()?.split("#")[0] ?? null
    }

    get storageUrls(): Set<string> {
        // TODO: When available - this.pimStorage.union(this.solidStorage)
        return new Set([...this.pimStorage, ...this.solidStorage])
    }

    get foafHomepage(): string | undefined {
        return this.singularNullable(FOAF.homepage, ValueMapping.literalToString)
    }

    get website(): string | null {
        return this.vcardHasUrl ?? this.foafHomepage ?? null
    }

    get photoUrl(): string | null {
        return this.singularNullable(VCARD.hasPhoto, ValueMapping.literalToString) ?? null
    }

    get pimStorage(): Set<string> {
        return this.objects(PIM.storage, ValueMapping.iriToString, TermMapping.stringToIri)
    }

    get solidStorage(): Set<string> {
        return this.objects(SOLID.storage, ValueMapping.iriToString, TermMapping.stringToIri)
    }

    get email(): string | null {
        return this.hasEmail?.actualValue ?? null
    }

    get hasEmail(): HasValue | undefined {
        return this.singularNullable(VCARD.hasEmail, ObjectMapping.as(HasValue))
    }

    get knows(): Set<string> {
        return this.objects(FOAF.knows, ValueMapping.iriToString, TermMapping.stringToIri)
    }
}

class HasValue extends TermWrapper {
    get actualValue(): string {
        return this.hasValue ?? this.value
    }

    get hasValue(): string | undefined {
        return this.singularNullable(VCARD.hasValue, ValueMapping.iriToString)
    }
}
