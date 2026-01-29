import { DatasetWrapper } from "rdfjs-wrapper"
import { AccessControlResource } from "@/app/lib/class/AccessControlResource";
import { ACP } from "@/app/lib/class/Vocabulary"

export class AcrDataset extends DatasetWrapper {
    get acr(): AccessControlResource | undefined {
        const subjects = new Set([
            ...this.instancesOf(AccessControlResource, ACP.AccessControlResource),
            ...this.subjectsOf(AccessControlResource, ACP.resource),
            ...this.subjectsOf(AccessControlResource, ACP.accessControl),
            ...this.subjectsOf(AccessControlResource, ACP.memberAccessControl)
        ])

        for (const subject of subjects) {
            return subject
        }
    }
}
