"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import QRCode from "qrcode";
import { CheckCircle2, Copy, Loader2, Link as LinkIcon, ScanLine, Tags, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  const [copied, setCopied] = useState(false);
  const sessionId = session?.id;
  const sessionStatus = session?.status;
  const categoryById = new Map(categories.map((category) => [category.id, category]));
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
      setCopied(false);
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
        dark: "#020617",
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

  async function copyUrl() {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <Card className="glass rounded-lg">
      <CardHeader>
        <CardTitle>Gate session</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        {!session ? (
          <>
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
              <div className="grid grid-cols-2 rounded-md border border-border/70 p-1">
                <button
                  type="button"
                  onClick={() => setScope("all")}
                  className={`rounded px-3 py-2 text-sm font-medium transition ${
                    scope === "all"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  aria-pressed={scope === "all"}
                >
                  All categories
                </button>
                <button
                  type="button"
                  onClick={() => setScope("selected")}
                  className={`rounded px-3 py-2 text-sm font-medium transition ${
                    scope === "selected"
                      ? "bg-primary text-primary-foreground"
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
                      className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md border border-border/60 px-3 py-2 text-sm transition hover:border-border"
                    >
                      <input
                        type="checkbox"
                        checked={selectedCategoryIds.includes(category.id)}
                        onChange={() => toggleCategory(category.id)}
                        className="h-4 w-4 accent-primary"
                      />
                      <span className="flex-1">{category.name}</span>
                      <Badge variant="secondary">
                        {category.kind === "club_table" ? "Table" : "Ticket"}
                      </Badge>
                    </label>
                  ))}
                  {categories.length === 0 ? (
                    <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
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
          </>
        ) : (
          <div className="grid gap-4">
            <div className="flex items-center justify-between">
              <Badge variant={session.status === "open" ? "success" : "secondary"}>{session.status}</Badge>
              {session.gate_name ? <span className="text-sm text-muted-foreground">{session.gate_name}</span> : null}
            </div>
            <div className="rounded-md border border-border/70 p-3 text-sm">
              <div className="mb-2 flex items-center gap-2 text-muted-foreground">
                <Tags className="h-4 w-4" />
                Accepted categories
              </div>
              {session.allowed_category_ids?.length ? (
                <div className="flex flex-wrap gap-2">
                  {session.allowed_category_ids.map((categoryId) => (
                    <Badge key={categoryId} variant="secondary">
                      {categoryById.get(categoryId)?.name ?? "Category"}
                    </Badge>
                  ))}
                </div>
              ) : (
                <Badge variant="secondary">All categories</Badge>
              )}
            </div>
            <div className="grid gap-2 text-sm">
              <div className="grid justify-items-center gap-3 rounded-md border border-border/70 bg-white p-4">
                {qrDataUrl ? (
                  <Image
                    src={qrDataUrl}
                    alt="Gate redemption QR code"
                    width={256}
                    height={256}
                    unoptimized
                    className="h-64 w-64"
                  />
                ) : (
                  <div className="flex h-64 w-64 items-center justify-center text-slate-500">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                )}
              </div>
              <div>
                <p className="text-muted-foreground">Redeem address</p>
                <div className="mt-2 flex items-start gap-2 rounded-md bg-muted p-3">
                  <LinkIcon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <p className="break-all font-mono text-xs">{url}</p>
                </div>
              </div>
              <Button type="button" variant="outline" onClick={copyUrl}>
                <Copy className="h-4 w-4" />
                {copied ? "Copied" : "Copy address"}
              </Button>
              <p className="text-muted-foreground">Short code</p>
              <p className="rounded-md bg-secondary p-4 text-center font-mono text-3xl tracking-[0.35em]">
                {session.short_code}
              </p>
            </div>

            <div
              className="rounded-md border border-border/70 p-4"
              aria-live="polite"
            >
              <div className="flex items-center gap-2">
                {last ? (
                  valid ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-300" />
                  ) : (
                    <XCircle className="h-5 w-5 text-destructive" />
                  )
                ) : (
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                )}
                <Badge variant={!last ? "secondary" : valid ? "success" : "destructive"}>
                  {last ? last.result : "waiting"}
                </Badge>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {last
                  ? lastTicket
                    ? `Ticket #${lastTicket.serial_number} · ${last.evm_address?.slice(0, 6)}…`
                    : "Awaiting backend write"
                  : "Waiting for customer to redeem."}
              </p>
            </div>

            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={closeGate} disabled={session.status !== "open"}>
                Close gate
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
                Open another
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
