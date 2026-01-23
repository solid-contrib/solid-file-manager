import { DataFactory } from "n3"

export class DC {
    static modified = DataFactory.namedNode("http://purl.org/dc/terms/modified")
    static title = DataFactory.namedNode("http://purl.org/dc/terms/title")
}

export class LDP {
    static contains = DataFactory.namedNode("http://www.w3.org/ns/ldp#contains")
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
