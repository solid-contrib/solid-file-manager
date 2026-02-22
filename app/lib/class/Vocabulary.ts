export const ACP = {
    resource: "http://www.w3.org/ns/solid/acp#resource",
    accessControl: "http://www.w3.org/ns/solid/acp#accessControl",
    memberAccessControl: "http://www.w3.org/ns/solid/acp#memberAccessControl",
    AccessControlResource: "http://www.w3.org/ns/solid/acp#AccessControlResource",
    apply: "http://www.w3.org/ns/solid/acp#apply",
    anyOf: "http://www.w3.org/ns/solid/acp#anyOf",
    agent: "http://www.w3.org/ns/solid/acp#agent",
    Matcher: "http://www.w3.org/ns/solid/acp#Matcher",
    Policy: "http://www.w3.org/ns/solid/acp#Policy",
    allow: "http://www.w3.org/ns/solid/acp#allow",
    mode: "http://www.w3.org/ns/solid/acp#mode",
    AccessControl: "http://www.w3.org/ns/solid/acp#AccessControl",
} as const

export const DC = {
    modified:  "http://purl.org/dc/terms/modified",
    title:  "http://purl.org/dc/terms/title",
} as const

export const FOAF = {
    isPrimaryTopicOf: "http://xmlns.com/foaf/0.1/isPrimaryTopicOf",
    primaryTopic: "http://xmlns.com/foaf/0.1/primaryTopic",
    fname: "http://xmlns.com/foaf/0.1/name",
    email: "http://xmlns.com/foaf/0.1/email",
    homepage: "http://xmlns.com/foaf/0.1/homepage",
    knows: "http://xmlns.com/foaf/0.1/knows",
} as const

export const LDP = {
    contains:  "http://www.w3.org/ns/ldp#contains",
} as const

export const PIM = {
    storage:  "http://www.w3.org/ns/pim/space#storage",
} as const

export const POSIX = {
    size:  "http://www.w3.org/ns/posix/stat#size",
    mtime:  "http://www.w3.org/ns/posix/stat#mtime",
} as const

export const RDF = {
    type: "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
} as const

export const RDFS = {
    label:  "http://www.w3.org/2000/01/rdf-schema#label",
} as const

export const SOLID = {
    oidcIssuer:  "http://www.w3.org/ns/solid/terms#oidcIssuer",
    storage:  "http://www.w3.org/ns/solid/terms#storage",
} as const

export const VCARD = {
    fn:  "http://www.w3.org/2006/vcard/ns#fn",
    hasEmail:  "http://www.w3.org/2006/vcard/ns#hasEmail",
    hasValue:  "http://www.w3.org/2006/vcard/ns#hasValue",
    hasPhoto:  "http://www.w3.org/2006/vcard/ns#hasPhoto",
    hasTelephone:  "http://www.w3.org/2006/vcard/ns#hasTelephone",
    title:  "http://www.w3.org/2006/vcard/ns#title",
    hasUrl:  "http://www.w3.org/2006/vcard/ns#hasUrl",
    organizationName:  "http://www.w3.org/2006/vcard/ns#organization-name",
    role:  "http://www.w3.org/2006/vcard/ns#organization-name",
} as const
