import { ImageResponse } from "next/og";
import { createServiceClient } from "@/lib/supabase/service";
import type { EventRow } from "@/types/db";

export const runtime = "nodejs";
export const alt = "MISO — Event";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

async function getEvent(id: string): Promise<EventRow | null> {
  const sb = createServiceClient();
  const { data } = await sb
    .from("events")
    .select("*")
    .eq("id", id)
    .eq("status", "published")
    .maybeSingle<EventRow>();
  return data ?? null;
}

function formatOgDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    timeZone: "Europe/Paris",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default async function Image({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const event = await getEvent(id);

  // Generic fallback card
  if (!event) {
    return new ImageResponse(
      <div
        style={{
          width: 1200,
          height: 630,
          background: "#0e0e0f",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        {/* Signal accent bar */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 4,
            background: "#ff6333",
          }}
        />
        <div
          style={{
            fontSize: 72,
            fontWeight: 900,
            color: "#ede8df",
            letterSpacing: "-2px",
          }}
        >
          MISO
        </div>
        <div
          style={{
            marginTop: 16,
            fontSize: 22,
            color: "#6b6b72",
            letterSpacing: "4px",
            textTransform: "uppercase",
          }}
        >
          LIVE EVENTS
        </div>
      </div>,
      { ...size },
    );
  }

  const meta = [formatOgDate(event.date), event.venue_name, event.city]
    .filter(Boolean)
    .join("  ·  ");

  return new ImageResponse(
    <div
      style={{
        width: 1200,
        height: 630,
        background: "#0e0e0f",
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
        padding: "60px 72px",
        fontFamily: "system-ui, sans-serif",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Signal accent bar top */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 4,
          background: "#ff6333",
        }}
      />

      {/* Radial glow — matches app background treatment */}
      <div
        style={{
          position: "absolute",
          top: -120,
          right: -80,
          width: 700,
          height: 500,
          borderRadius: "50%",
          background:
            "radial-gradient(ellipse at center, rgba(255,99,51,0.12) 0%, transparent 70%)",
        }}
      />

      {/* Signal dot accent */}
      <div
        style={{
          position: "absolute",
          top: 60,
          right: 72,
          width: 10,
          height: 10,
          borderRadius: "50%",
          background: "#ff6333",
        }}
      />

      {/* MISO wordmark */}
      <div
        style={{
          position: "absolute",
          top: 48,
          left: 72,
          fontSize: 18,
          fontWeight: 800,
          color: "#ede8df",
          letterSpacing: "4px",
          textTransform: "uppercase",
        }}
      >
        MISO
      </div>

      {/* Event name */}
      <div
        style={{
          fontSize:
            event.name.length > 40 ? 56 : event.name.length > 24 ? 68 : 80,
          fontWeight: 900,
          color: "#ede8df",
          letterSpacing: "-2px",
          lineHeight: 1.05,
          marginBottom: 28,
          maxWidth: 960,
        }}
      >
        {event.name}
      </div>

      {/* Date · Venue · City */}
      <div
        style={{
          fontSize: 20,
          fontWeight: 500,
          color: "#8a8a94",
          letterSpacing: "3px",
          textTransform: "uppercase",
          fontFamily: "ui-monospace, monospace",
        }}
      >
        {meta}
      </div>

      {/* Bottom hairline */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 72,
          right: 72,
          height: 1,
          background: "rgba(255,255,255,0.08)",
        }}
      />
    </div>,
    { ...size },
  );
}
