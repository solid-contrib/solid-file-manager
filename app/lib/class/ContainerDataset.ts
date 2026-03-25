import { DatasetWrapper } from "@rdfjs/wrapper"
import { Container } from "@/app/lib/class/Container"
import { LDP } from "@/app/lib/class/Vocabulary"

export class ContainerDataset extends DatasetWrapper {
    // TODO: Consider that this might be undefined if there are no contained resources. We might need different matching.
    get container(): Container | undefined {
        // Return the first container in the dataset
        for (const s of this.subjectsOf(LDP.contains, Container)) {
            return s;
        }
    }
}
