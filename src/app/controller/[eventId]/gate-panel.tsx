"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import QRCode from "qrcode";
import { CheckCircle2, Loader2, ScanLine, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/use-toast";

interface GateSession {
  id: string;
  short_code: string;
  gate_name: string | null;
  allowed_category_ids: string[] | null;
  status: "open" | "closed" | "expired";
  expires_at: string;
  last_result: string | null;
  last_ticket_id: string | null;
  last_redemption_id: string | null;
}

interface PollResponse {
  session: GateSession;
  last_redemption: { id: string; result: string; redeemed_at: string; evm_address: string | null } | null;
  last_ticket: { id: string; serial_number: number; status: string } | null;
}

interface GateCategoryOption {
  id: string;
  name: string;
  kind: string;
}

export function GatePanel({
  eventId,
  origin,
  categories,
}: {
  eventId: string;
  origin: string;
  categories: GateCategoryOption[];
}) {
  const [gateName, setGateName] = useState("");
  const [scope, setScope] = useState<"all" | "selected">("all");
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [session, setSession] = useState<GateSession | null>(null);
  const [last, setLast] = useState<PollResponse["last_redemption"]>(null);
  const [lastTicket, setLastTicket] = useState<PollResponse["last_ticket"]>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const sessionId = session?.id;
  const sessionStatus = session?.status;
  const needsCategorySelection = scope === "selected" && selectedCategoryIds.length === 0;

  function toggleCategory(categoryId: string) {
    setSelectedCategoryIds((current) =>
      current.includes(categoryId)
        ? current.filter((id) => id !== categoryId)
        : [...current, categoryId],
    );
  }

  async function openGate() {
    if (needsCategorySelection) return;
    setCreating(true);
    try {
      const res = await fetch("/api/controller/gates", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          event_id: eventId,
          gate_name: gateName || undefined,
          allowed_category_ids: scope === "selected" ? selectedCategoryIds : undefined,
        }),
      });
      const payload = (await res.json()) as GateSession & { error?: string };
      if (!res.ok) throw new Error(payload.error ?? "Could not open gate");
      setSession(payload);
      setLast(null);
      setLastTicket(null);
    } catch (error) {
      toast({
        title: "Gate failed to open",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  }

  async function closeGate() {
    if (!session) return;
    try {
      const res = await fetch(`/api/controller/gates/${session.id}/close`, { method: "POST" });
      const payload = (await res.json()) as GateSession & { error?: string };
      if (!res.ok) throw new Error(payload.error ?? "Could not close gate");
      setSession(payload);
    } catch (error) {
      toast({
        title: "Could not close gate",
        description: error instanceof Error ? error.message : "",
        variant: "destructive",
      });
    }
  }

  useEffect(() => {
    if (!sessionId || sessionStatus !== "open") return;
    const tick = async () => {
      const res = await fetch(`/api/controller/gates/${sessionId}`, { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as PollResponse;
      setSession(data.session);
      setLast(data.last_redemption);
      setLastTicket(data.last_ticket);
    };
    void tick();
    const id = window.setInterval(tick, 2500);
    return () => window.clearInterval(id);
  }, [sessionId, sessionStatus]);

  const url = session ? `${origin}/redeem/${session.short_code}` : null;
  const valid = last?.result === "valid";

  useEffect(() => {
    let cancelled = false;
    if (!url) {
      setQrDataUrl(null);
      return;
    }

    QRCode.toDataURL(url, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 280,
      color: {
        dark: "#0e0e10",
        light: "#ffffff",
      },
    })
      .then((dataUrl) => {
        if (!cancelled) setQrDataUrl(dataUrl);
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl(null);
      });

    return () => {
      cancelled = true;
    };
  }, [url]);

  const gateClosed = session?.status !== "open";
  const activeTone = gateClosed
    ? "border-destructive/40 bg-destructive/10"
    : !last
    ? "border-hairline bg-ink-raised"
    : valid
      ? "border-signal/40 bg-signal/10"
      : "border-destructive/40 bg-destructive/10";
  const activeMessage = gateClosed
    ? "Gate closed"
    : !last
    ? "Waiting for scan"
    : valid
      ? lastTicket
        ? `Ticket #${lastTicket.serial_number} consumed`
        : "Ticket consumed"
      : gateResultMessage(last.result);

  if (session) {
    return (
      <section
        className={`grid min-h-[520px] content-center justify-items-center gap-5 rounded-md border p-6 text-center transition-colors duration-300 ${activeTone}`}
        aria-live="polite"
      >
        <div className="grid justify-items-center gap-4">
          <div className="grid h-[min(72vw,340px)] w-[min(72vw,340px)] place-items-center rounded-md bg-paper p-4 shadow-[0_24px_80px_-44px_rgba(0,0,0,0.9)]">
            {qrDataUrl ? (
              <Image
                src={qrDataUrl}
                alt="Gate redemption QR code"
                width={304}
                height={304}
                unoptimized
                className="h-full w-full"
              />
            ) : (
              <Loader2 className="h-8 w-8 animate-spin text-ink/40" />
            )}
          </div>

          <div className="grid justify-items-center gap-2">
            {last ? (
              valid ? (
                <CheckCircle2 className="h-7 w-7 text-signal" />
              ) : (
                <XCircle className="h-7 w-7 text-destructive" />
              )
            ) : (
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            )}
            <p className="text-sm font-medium text-foreground">{activeMessage}</p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={closeGate} disabled={session.status !== "open"}>
            Close
          </Button>
          <Button
            type="button"
            onClick={() => {
              setSession(null);
              setLast(null);
              setLastTicket(null);
            }}
            variant="ghost"
          >
            New
          </Button>
        </div>
      </section>
    );
  }

  return (
    <div className="rounded-md border border-hairline bg-ink-raised">
      <div className="border-b border-hairline px-6 py-5">
        <p className="eyebrow">Door</p>
        <h2 className="display mt-2 text-2xl text-foreground">
          Open gate<span className="display-italic">.</span>
        </h2>
      </div>
      <div className="grid gap-5 p-6">
        <div className="grid gap-2">
          <Label htmlFor="gate">Gate name (optional)</Label>
          <Input
            id="gate"
            placeholder="Main gate"
            value={gateName}
            onChange={(event) => setGateName(event.target.value)}
          />
        </div>
        <div className="grid gap-3">
          <Label>Accepted categories</Label>
          <div className="grid grid-cols-2 rounded-md border border-hairline p-1">
            <button
              type="button"
              onClick={() => setScope("all")}
              className={`rounded px-3 py-2 text-xs font-medium uppercase tracking-[0.18em] transition ${
                scope === "all"
                  ? "bg-signal text-ink"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              aria-pressed={scope === "all"}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setScope("selected")}
              className={`rounded px-3 py-2 text-xs font-medium uppercase tracking-[0.18em] transition ${
                scope === "selected"
                  ? "bg-signal text-ink"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              aria-pressed={scope === "selected"}
            >
              Selected
            </button>
          </div>
          {scope === "selected" ? (
            <div className="grid gap-2">
              {categories.map((category) => (
                <label
                  key={category.id}
                  className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md border border-hairline px-3 py-2 text-sm transition hover:border-hairline-strong"
                >
                  <input
                    type="checkbox"
                    checked={selectedCategoryIds.includes(category.id)}
                    onChange={() => toggleCategory(category.id)}
                    className="h-4 w-4 accent-signal"
                  />
                  <span className="flex-1">{category.name}</span>
                  <Badge variant="secondary">
                    {category.kind === "club_table" ? "Table" : "Ticket"}
                  </Badge>
                </label>
              ))}
              {categories.length === 0 ? (
                <p className="rounded-md border border-dashed border-hairline p-3 text-sm text-muted-foreground">
                  No ticket categories have been created for this event.
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
        <Button type="button" onClick={openGate} disabled={creating || needsCategorySelection}>
          {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanLine className="h-4 w-4" />}
          Open gate
        </Button>
      </div>
    </div>
  );
}

function gateResultMessage(result: string): string {
  switch (result) {
    case "already_used":
      return "Ticket already consumed";
    case "wrong_event":
      return "Wrong event";
    case "wrong_category":
      return "Wrong ticket category";
    case "owner_mismatch":
      return "Ticket owner mismatch";
    case "no_ticket":
      return "Ticket not found";
    case "refunded":
      return "Ticket refunded";
    case "canceled":
      return "Ticket canceled";
    case "expired":
      return "Ticket expired";
    case "no_session":
      return "Gate closed";
    default:
      return "Entry failed";
  }
}
