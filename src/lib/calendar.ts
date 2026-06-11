export interface IcsEventInput {
  name: string;
  description: string | null;
  venueName: string;
  city: string;
  date: string;
  endDate?: string | null;
  url: string;
  uid: string;
}

function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

function toUtcStamp(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    d.getUTCFullYear() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    "T" +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    "Z"
  );
}

function fold(line: string): string {
  // RFC 5545 §3.1: fold at 75 octets (bytes), continuation lines start with a single space
  const bytes = Buffer.from(line, "utf8");
  if (bytes.length <= 75) return line;

  const parts: string[] = [];
  let offset = 0;

  while (offset < bytes.length) {
    const limit = offset === 0 ? 75 : 74;
    let end = offset + limit;
    if (end >= bytes.length) {
      parts.push(bytes.slice(offset).toString("utf8"));
      break;
    }
    // Walk back to a valid UTF-8 boundary
    while (end > offset && (bytes[end] & 0xc0) === 0x80) end--;
    parts.push(bytes.slice(offset, end).toString("utf8"));
    offset = end;
  }

  return parts.join("\r\n ");
}

function prop(name: string, value: string): string {
  return fold(`${name}:${value}`);
}

export function buildIcs(event: IcsEventInput): string {
  const dtstart = toUtcStamp(event.date);
  const dtend = event.endDate
    ? toUtcStamp(event.endDate)
    : toUtcStamp(new Date(new Date(event.date).getTime() + 4 * 60 * 60 * 1000).toISOString());
  const dtstamp = toUtcStamp(new Date().toISOString());
  const location = escapeText(`${event.venueName}, ${event.city}`);
  const summary = escapeText(event.name);
  const description = escapeText(event.description ?? "");

  const lines = [
    "BEGIN:VCALENDAR",
    prop("VERSION", "2.0"),
    prop("PRODID", "-//MISO//MISO//EN"),
    prop("CALSCALE", "GREGORIAN"),
    prop("METHOD", "PUBLISH"),
    "BEGIN:VEVENT",
    prop("UID", event.uid),
    prop("DTSTAMP", dtstamp),
    prop("DTSTART", dtstart),
    prop("DTEND", dtend),
    prop("SUMMARY", summary),
    prop("DESCRIPTION", description),
    prop("LOCATION", location),
    prop("URL", event.url),
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  return lines.join("\r\n") + "\r\n";
}
