import { describe, expect, it } from "vitest";
import { describeMoveError, describeMoveResult } from "./moveMessages";
import { IndeterminateMoveError, type MoveResult } from "./moveUtils";

const moved = (overrides: Partial<MoveResult>): MoveResult => ({
  url: "https://pod.example/archive/note.txt",
  name: "note.txt",
  requestedName: "note.txt",
  originalName: "note.txt",
  sourceRemoved: true,
  ...overrides,
});

describe("describeMoveResult", () => {
  it.each([
    ["a plain move", moved({}), "success", 'Moved "note.txt"'],
    ["a server-chosen name", moved({ name: "note-1.txt" }), "success", 'Moved as "note-1.txt"'],
    ["a rename the server ignored", moved({ requestedName: "new.txt" }), "warning", 'still "note.txt"'],
    ["an original that could not be removed", moved({ sourceRemoved: false }), "error", "Both copies now exist"],
  ])("describes %s", (_label, result, type, text) => {
    const message = describeMoveResult(result);
    expect(message.type).toBe(type);
    expect(message.title).toContain(text);
  });
});

describe("describeMoveError", () => {
  it("warns that the original was kept when the move cannot be confirmed", () => {
    const message = describeMoveError(new IndeterminateMoveError("https://pod.example/archive/", null));
    expect(message).toMatchObject({ type: "warning" });
    expect(message.title).toContain("original has been left in place");
  });

  it.each([401, 403, 404, 409, 412, 413, 415, 507])(
    "explains HTTP %i and says nothing was moved",
    (status) => {
      expect(describeMoveError({ status })).toMatchObject({
        type: "error",
        title: expect.stringContaining("Nothing was moved"),
      });
    },
  );

  it("reports an unreachable server when there is no status", () => {
    expect(describeMoveError(new TypeError("network down")).title).toContain("Could not reach the server");
  });

  it("falls back to the error message for other statuses", () => {
    const error = Object.assign(new Error("boom"), { status: 500 });
    expect(describeMoveError(error).title).toBe("Failed to move: boom");
  });
});
