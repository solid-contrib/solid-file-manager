import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formatDate } from "./dateUtils";

const NOW = new Date("2026-11-16T12:00:00Z");
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000);

describe("formatDate", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => vi.useRealTimers());

  it.each([
    [0, "Today"],
    [1, "Yesterday"],
    [3, "3 days ago"],
    [14, "2 weeks ago"],
  ])("%i day(s) ago → %s", (days, expected) => {
    expect(formatDate(daysAgo(days))).toBe(expected);
  });

  it("falls back to the locale date after a month, and to empty for no date", () => {
    const old = daysAgo(60);
    expect(formatDate(old)).toBe(old.toLocaleDateString());
    expect(formatDate(undefined)).toBe("");
  });
});
