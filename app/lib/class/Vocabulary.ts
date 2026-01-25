import { DataFactory } from "n3"

export class ACP {
    static resource = DataFactory.namedNode("http://www.w3.org/ns/solid/acp#resource")
    static accessControl = DataFactory.namedNode("http://www.w3.org/ns/solid/acp#accessControl")
    static memberAccessControl = DataFactory.namedNode("http://www.w3.org/ns/solid/acp#memberAccessControl")
    static AccessControlResource = DataFactory.namedNode("http://www.w3.org/ns/solid/acp#AccessControlResource")
    static apply = DataFactory.namedNode("http://www.w3.org/ns/solid/acp#apply")
    static anyOf = DataFactory.namedNode("http://www.w3.org/ns/solid/acp#anyOf")
    static agent = DataFactory.namedNode("http://www.w3.org/ns/solid/acp#agent")
    static Matcher = DataFactory.namedNode("http://www.w3.org/ns/solid/acp#Matcher")
    static Policy = DataFactory.namedNode("http://www.w3.org/ns/solid/acp#Policy")
    static allow = DataFactory.namedNode("http://www.w3.org/ns/solid/acp#allow")
    static mode = DataFactory.namedNode("http://www.w3.org/ns/solid/acp#mode")
    static AccessControl = DataFactory.namedNode("http://www.w3.org/ns/solid/acp#AccessControl")
}

export class DC {
    static modified = DataFactory.namedNode("http://purl.org/dc/terms/modified")
    static title = DataFactory.namedNode("http://purl.org/dc/terms/title")
}

export class FOAF {
    static primaryTopic = DataFactory.namedNode("http://xmlns.com/foaf/0.1/primaryTopic")
    static name = DataFactory.namedNode("http://xmlns.com/foaf/0.1/name")
    static email = DataFactory.namedNode("http://xmlns.com/foaf/0.1/email")
    static homepage = DataFactory.namedNode("http://xmlns.com/foaf/0.1/homepage")
    static knows = DataFactory.namedNode("http://xmlns.com/foaf/0.1/knows")
}

export class LDP {
    static contains = DataFactory.namedNode("http://www.w3.org/ns/ldp#contains")
}

export class PIM {
    static storage = DataFactory.namedNode("http://www.w3.org/ns/pim/space#storage")
}

export class POSIX {
    static size = DataFactory.namedNode("http://www.w3.org/ns/posix/stat#size")
    static mtime = DataFactory.namedNode("http://www.w3.org/ns/posix/stat#mtime")
}

export class RDF {
    static type = DataFactory.namedNode("http://www.w3.org/1999/02/22-rdf-syntax-ns#type")
}

export class RDFS {
    static label = DataFactory.namedNode("http://www.w3.org/2000/01/rdf-schema#label")
}

export class SOLID {
    static storage = DataFactory.namedNode("http://www.w3.org/ns/solid/terms#storage")
}

export class VCARD {
    static fn = DataFactory.namedNode("http://www.w3.org/2006/vcard/ns#fn")
    static hasEmail = DataFactory.namedNode("http://www.w3.org/2006/vcard/ns#hasEmail")
    static hasValue = DataFactory.namedNode("http://www.w3.org/2006/vcard/ns#hasValue")
    static hasPhoto = DataFactory.namedNode("http://www.w3.org/2006/vcard/ns#hasPhoto")
    static hasTelephone = DataFactory.namedNode("http://www.w3.org/2006/vcard/ns#hasTelephone")
    static title = DataFactory.namedNode("http://www.w3.org/2006/vcard/ns#title")
    static hasUrl = DataFactory.namedNode("http://www.w3.org/2006/vcard/ns#hasUrl")
    static organizationName = DataFactory.namedNode("http://www.w3.org/2006/vcard/ns#organization-name")
    static role = DataFactory.namedNode("http://www.w3.org/2006/vcard/ns#organization-name")
}
