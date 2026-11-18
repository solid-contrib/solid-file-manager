import { describe, expect, it } from "vitest";
import { buildBreadcrumbItems } from "./breadcrumbUtils";

const STORAGE = "https://pod.example/alice/";
const ROOT = { name: "My Solid Storages", path: "/" };

describe("buildBreadcrumbItems", () => {
  it("shows only the root when no storage is selected", () => {
    expect(buildBreadcrumbItems(null, undefined, undefined, "/")).toEqual([ROOT]);
  });

  it("shows the storage at its own root", () => {
    expect(buildBreadcrumbItems("s1", STORAGE, "Alice", STORAGE)).toEqual([
      ROOT,
      { name: "Alice", path: STORAGE },
    ]);
  });

  it("adds one decoded crumb per folder below the storage", () => {
    expect(buildBreadcrumbItems("s1", STORAGE, "Alice", `${STORAGE}docs/My%20Notes/`)).toEqual([
      ROOT,
      { name: "Alice", path: STORAGE },
      { name: "docs", path: `${STORAGE}docs/` },
      { name: "My Notes", path: `${STORAGE}docs/My%20Notes/` },
    ]);
  });
});
