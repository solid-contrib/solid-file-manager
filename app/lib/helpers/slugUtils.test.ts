import { describe, expect, it } from "vitest";
import { fakeFetch } from "../testing/fakeFetch";
import {
  createResourceWithSlug,
  isIndeterminateWriteError,
  isNameConflictError,
  nameFromSavedUrl,
} from "./slugUtils";

const FOLDER = "https://pod.example/docs/";

describe("isNameConflictError", () => {
  it.each([
    [{ status: 409 }, true],
    [{ status: 412 }, true],
    [{ status: 404 }, false],
    [new Error("no status"), false],
  ])("%o → %s", (error, expected) => {
    expect(isNameConflictError(error)).toBe(expected);
  });
});

describe("isIndeterminateWriteError", () => {
  it("is true only when the error carries no HTTP status", () => {
    expect(isIndeterminateWriteError(new TypeError("network down"))).toBe(true);
    expect(isIndeterminateWriteError({ status: 500 })).toBe(false);
  });
});

describe("nameFromSavedUrl", () => {
  it.each([
    [`${FOLDER}report.pdf`, "report.pdf"],
    [`${FOLDER}My%20Notes/`, "My Notes"],
    ["https://elsewhere.example/a/b/photo.png", "photo.png"],
    ["not a url", "not a url"],
  ])("%s → %s", (savedUrl, expected) => {
    expect(nameFromSavedUrl(savedUrl, FOLDER)).toBe(expected);
  });
});

describe("createResourceWithSlug", () => {
  /** Echoes the Slug header back as the created resource's name. */
  function echoSlug() {
    const slugs: (string | null)[] = [];
    const { fetch } = fakeFetch((request) => {
      const slug = request.headers.get("Slug");
      slugs.push(slug);
      return new Response(null, { status: 201, headers: { Location: FOLDER + slug } });
    });
    return { fetch, slugs };
  }

  it("asks for the name as given when it is safe in an HTTP header", async () => {
    const { fetch, slugs } = echoSlug();

    const result = await createResourceWithSlug(FOLDER, new Blob(["x"]), "notes.txt", "text/plain", fetch);

    expect(slugs).toEqual(["notes.txt"]);
    expect(result).toEqual({ url: `${FOLDER}notes.txt`, name: "notes.txt", slugRespected: true });
  });

  it("percent-encodes names that are not safe in an HTTP header", async () => {
    const { fetch, slugs } = echoSlug();

    const result = await createResourceWithSlug(FOLDER, new Blob(["x"]), "café.txt", "text/plain", fetch);

    expect(slugs).toEqual(["caf%C3%A9.txt"]);
    expect(result).toMatchObject({ name: "café.txt", slugRespected: true });
  });
});
