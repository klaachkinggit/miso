import { describe, expect, it } from "vitest";
import { csvCell, csvRow } from "@/lib/csv";

describe("csvCell", () => {
  it("passes through plain values unchanged", () => {
    expect(csvCell("hello")).toBe("hello");
    expect(csvCell(42)).toBe("42");
  });

  it("wraps in quotes when field contains a comma", () => {
    expect(csvCell("Smith, John")).toBe('"Smith, John"');
  });

  it("doubles embedded quotes and wraps", () => {
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
  });

  it("wraps in quotes when field contains a newline", () => {
    expect(csvCell("line1\nline2")).toBe('"line1\nline2"');
  });

  it("returns empty string for null and undefined", () => {
    expect(csvCell(null)).toBe("");
    expect(csvCell(undefined)).toBe("");
  });
});

describe("csvRow", () => {
  it("joins cells with commas", () => {
    expect(csvRow(["a", "b", "c"])).toBe("a,b,c");
  });

  it("escapes cells that need quoting", () => {
    expect(csvRow(["a,b", "c"])).toBe('"a,b",c');
  });

  it("handles mixed nulls and values", () => {
    expect(csvRow([null, "x", undefined])).toBe(",x,");
  });
});
