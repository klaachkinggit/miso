import { describe, expect, it } from "vitest";
import { buildIcs } from "@/lib/calendar";

const base = {
  name: "Test Event",
  description: "A great night",
  venueName: "Concrete",
  city: "Paris",
  date: "2026-08-15T22:00:00.000Z",
  url: "https://example.com/events/abc",
  uid: "event-abc@miso",
};

describe("buildIcs", () => {
  it("returns a string with CRLF line endings throughout", () => {
    const ics = buildIcs(base);
    expect(ics).toContain("\r\n");
    // No bare LF without a preceding CR
    const bareLf = ics.replace(/\r\n/g, "").includes("\n");
    expect(bareLf).toBe(false);
  });

  it("wraps in VCALENDAR / VEVENT blocks", () => {
    const ics = buildIcs(base);
    expect(ics).toContain("BEGIN:VCALENDAR\r\n");
    expect(ics).toContain("BEGIN:VEVENT\r\n");
    expect(ics).toContain("END:VEVENT\r\n");
    expect(ics).toContain("END:VCALENDAR\r\n");
  });

  it("encodes DTSTART and DTSTAMP as UTC stamps", () => {
    const ics = buildIcs(base);
    expect(ics).toContain("DTSTART:20260815T220000Z");
    expect(ics).toMatch(/DTSTAMP:\d{8}T\d{6}Z/);
  });

  it("defaults DTEND to 4 hours after start when endDate is omitted", () => {
    const ics = buildIcs(base);
    // 22:00 UTC + 4h = 02:00 next day
    expect(ics).toContain("DTEND:20260816T020000Z");
  });

  it("uses provided endDate when supplied", () => {
    const ics = buildIcs({ ...base, endDate: "2026-08-16T04:00:00.000Z" });
    expect(ics).toContain("DTEND:20260816T040000Z");
  });

  it("null endDate falls back to default 4-hour duration", () => {
    const ics = buildIcs({ ...base, endDate: null });
    expect(ics).toContain("DTEND:20260816T020000Z");
  });

  it("escapes commas in text fields", () => {
    const ics = buildIcs({ ...base, name: "Rain, Fire & Ice" });
    expect(ics).toContain("SUMMARY:Rain\\, Fire & Ice");
  });

  it("escapes semicolons in text fields", () => {
    const ics = buildIcs({ ...base, description: "Doors open; bring ID" });
    expect(ics).toContain("DESCRIPTION:Doors open\\; bring ID");
  });

  it("escapes backslashes in text fields", () => {
    const ics = buildIcs({ ...base, name: "Back\\slash" });
    expect(ics).toContain("SUMMARY:Back\\\\slash");
  });

  it("escapes newlines in description", () => {
    const ics = buildIcs({ ...base, description: "Line1\nLine2" });
    expect(ics).toContain("DESCRIPTION:Line1\\nLine2");
  });

  it("folds lines that exceed 75 octets", () => {
    const longName = "A".repeat(80);
    const ics = buildIcs({ ...base, name: longName });
    const lines = ics.split("\r\n");
    const summaryLine = lines.find((l) => l.startsWith("SUMMARY:"));
    expect(summaryLine).toBeDefined();
    // The first segment must be ≤75 bytes
    expect(Buffer.byteLength(summaryLine!, "utf8")).toBeLessThanOrEqual(75);
    // The continuation line must start with a space
    const idx = lines.indexOf(summaryLine!);
    expect(lines[idx + 1]).toMatch(/^ /);
  });

  it("does not fold lines that are exactly 75 octets", () => {
    // "SUMMARY:" is 8 bytes; pad name to 67 chars so the full line is exactly 75
    const name = "B".repeat(67);
    const ics = buildIcs({ ...base, name });
    const lines = ics.split("\r\n");
    const idx = lines.findIndex((l) => l.startsWith("SUMMARY:"));
    expect(idx).toBeGreaterThan(-1);
    // Next line must not be a continuation (space-prefixed)
    expect(lines[idx + 1]).not.toMatch(/^ /);
  });

  it("includes the UID, URL, and LOCATION properties", () => {
    const ics = buildIcs(base);
    expect(ics).toContain("UID:event-abc@miso");
    expect(ics).toContain("URL:https://example.com/events/abc");
    expect(ics).toContain("LOCATION:Concrete\\, Paris");
  });

  it("handles null description gracefully", () => {
    const ics = buildIcs({ ...base, description: null });
    expect(ics).toContain("DESCRIPTION:");
    // Shouldn't throw or produce 'null' literally
    expect(ics).not.toContain("DESCRIPTION:null");
  });
});
