"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Step = "redeeming" | "done" | "error";

interface TicketOption {
  id: string;
  serial_number: number;
  category_name: string;
  contract_address: string;
  token_id: number;
}

interface ConfirmResponse {
  result: string;
  reason?: string;
  redemption_id?: string;
  redeem_tx_signature?: string;
  attr_tx_signature?: string;
}

export interface RedeemPanelProps {
  gateShortCode: string;
  tickets: TicketOption[];
  token?: string;
}

export function RedeemPanel({
  gateShortCode,
  tickets,
  token,
}: RedeemPanelProps) {
  const hasChoice = tickets.length > 1;
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(
    hasChoice ? null : (tickets[0]?.id ?? null),
  );
  const ticket =
    tickets.find((option) => option.id === selectedTicketId) ?? null;
  const [step, setStep] = useState<Step>(hasChoice ? "done" : "redeeming");
  const [outcome, setOutcome] = useState<ConfirmResponse | null>(null);

  useEffect(() => {
    if (!ticket) return;
    const controller = new AbortController();
    const redeem = async () => {
      const confRes = await fetch("/api/redeem/confirm", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          gate_short_code: gateShortCode,
          ticket_id: ticket.id,
          token,
        }),
        signal: controller.signal,
      });
      const conf = (await confRes.json()) as ConfirmResponse & {
        error?: string;
      };
      if (!conf.result)
        throw new Error(conf.error ?? "Could not redeem ticket");
      setOutcome(conf);
      setStep(conf.result === "valid" ? "done" : "error");
    };

    void redeem().catch((error) => {
      if (controller.signal.aborted) return;
      setOutcome({
        result: "failed",
        reason:
          error instanceof Error ? error.message : "Could not redeem ticket",
      });
      setStep("error");
    });

    return () => controller.abort();
  }, [gateShortCode, ticket, token]);

  const accepted = outcome?.result === "valid";
  const choosing = hasChoice && !ticket;
  const statusTone = choosing
    ? "border-hairline bg-ink-raised"
    : step === "redeeming"
      ? "border-hairline bg-ink-raised"
      : accepted
        ? "border-signal/40 bg-signal/10"
        : "border-destructive/40 bg-destructive/10";

  return (
    <section
      className={cn(
        "mx-auto grid min-h-[420px] max-w-sm content-center justify-items-center gap-5 rounded-md border p-6 text-center",
        statusTone,
      )}
      aria-live="polite"
    >
      {choosing ? (
        <Badge variant="secondary">choose ticket</Badge>
      ) : step === "redeeming" ? (
        <Loader2 className="h-12 w-12 animate-spin text-signal" />
      ) : accepted ? (
        <CheckCircle2 className="h-14 w-14 text-signal" />
      ) : (
        <XCircle className="h-14 w-14 text-destructive" />
      )}

      <div className="grid gap-2">
        {!choosing ? (
          <Badge
            variant={
              accepted
                ? "signal"
                : step === "redeeming"
                  ? "secondary"
                  : "destructive"
            }
          >
            {accepted
              ? "consumed"
              : step === "redeeming"
                ? "scanning"
                : "not accepted"}
          </Badge>
        ) : null}
        <h1 className="display text-2xl text-foreground">
          {choosing
            ? "Choose ticket"
            : accepted
              ? "Ticket consumed"
              : step === "redeeming"
                ? "Checking ticket"
                : "Entry failed"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {choosing
            ? "Select the ticket to consume for this gate."
            : accepted
              ? "Your entry is confirmed."
              : step === "redeeming"
                ? "Keep this screen open."
                : (outcome?.reason ??
                  "This ticket cannot enter through this gate.")}
        </p>
      </div>

      {choosing ? (
        <div className="grid w-full gap-2">
          {tickets.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => {
                setSelectedTicketId(option.id);
                setStep("redeeming");
                setOutcome(null);
              }}
              className="min-h-16 rounded-md border border-hairline bg-ink px-4 py-3 text-left transition hover:border-hairline-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
            >
              <span className="block text-xs uppercase tracking-[0.18em] text-muted-foreground">
                Ticket #{option.serial_number}
              </span>
              <span className="block font-medium text-foreground">
                {option.category_name}
              </span>
            </button>
          ))}
        </div>
      ) : ticket ? (
        <div className="w-full rounded-md border border-hairline bg-ink p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
            Ticket #{ticket.serial_number}
          </p>
          <p className="mt-1 text-lg font-medium text-foreground">
            {ticket.category_name}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Verified digital ticket
          </p>
        </div>
      ) : null}
    </section>
  );
}
