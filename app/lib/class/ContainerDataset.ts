import { DatasetWrapper } from "@rdfjs/wrapper";
import { Container } from "@/app/lib/class/Container";
import { LDP } from "@/app/lib/class/Vocabulary";

export class ContainerDataset extends DatasetWrapper {
  get container(): Container | undefined {
    // Non-empty containers advertise children via ldp:contains.
    for (const s of this.subjectsOf(LDP.contains, Container)) {
      return s;
    }

    // Empty containers have no ldp:contains; resolve via rdf:type instead.
    for (const s of this.instancesOf(LDP.Container, Container)) {
      return s;
    }

    for (const s of this.instancesOf(LDP.BasicContainer, Container)) {
      return s;
    }
  }
}
