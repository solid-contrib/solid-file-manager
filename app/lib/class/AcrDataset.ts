import { DatasetWrapper } from "rdfjs-wrapper"
import { AccessControlResource } from "@/app/lib/class/AccessControlResource";
import { ACP } from "@/app/lib/class/Vocabulary"

export class AcrDataset extends DatasetWrapper {
    get acr(): AccessControlResource | undefined {
        const subjects = new Set([
            ...this.instancesOf(ACP.AccessControlResource, AccessControlResource),
            ...this.subjectsOf(ACP.resource, AccessControlResource),
            ...this.subjectsOf(ACP.accessControl, AccessControlResource),
            ...this.subjectsOf(ACP.memberAccessControl, AccessControlResource)
        ])

        for (const subject of subjects) {
            return subject
        }
    }
}
