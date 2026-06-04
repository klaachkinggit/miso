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
}

export function RedeemPanel({ gateShortCode, tickets }: RedeemPanelProps) {
  const hasChoice = tickets.length > 1;
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(
    hasChoice ? null : (tickets[0]?.id ?? null),
  );
  const ticket = tickets.find((option) => option.id === selectedTicketId) ?? null;
  const [step, setStep] = useState<Step>(hasChoice ? "done" : "redeeming");
  const [outcome, setOutcome] = useState<ConfirmResponse | null>(null);

  useEffect(() => {
    if (!ticket) return;
    const controller = new AbortController();
    const redeem = async () => {
      const confRes = await fetch("/api/redeem/confirm", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ gate_short_code: gateShortCode, ticket_id: ticket.id }),
        signal: controller.signal,
      });
      const conf = (await confRes.json()) as ConfirmResponse & { error?: string };
      if (!conf.result) throw new Error(conf.error ?? "Could not redeem ticket");
      setOutcome(conf);
      setStep(conf.result === "valid" ? "done" : "error");
    };

    void redeem().catch((error) => {
      if (controller.signal.aborted) return;
      setOutcome({
        result: "failed",
        reason: error instanceof Error ? error.message : "Could not redeem ticket",
      });
      setStep("error");
    });

    return () => controller.abort();
  }, [gateShortCode, ticket]);

  const accepted = outcome?.result === "valid";
  const choosing = hasChoice && !ticket;
  const statusTone =
    choosing
      ? "border-white/15 bg-white/[0.04]"
      : step === "redeeming"
      ? "border-white/15 bg-white/[0.04]"
      : accepted
        ? "border-emerald-300/30 bg-emerald-300/10"
        : "border-red-300/30 bg-red-400/10";

  return (
    <section
      className={cn(
        "mx-auto grid min-h-[420px] max-w-sm content-center justify-items-center gap-5 rounded-lg border p-6 text-center",
        statusTone,
      )}
      aria-live="polite"
    >
      {choosing ? (
        <Badge variant="secondary">choose ticket</Badge>
      ) : step === "redeeming" ? (
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      ) : accepted ? (
        <CheckCircle2 className="h-14 w-14 text-emerald-200" />
      ) : (
        <XCircle className="h-14 w-14 text-red-200" />
      )}

      <div className="grid gap-2">
        {!choosing ? (
          <Badge variant={accepted ? "success" : step === "redeeming" ? "secondary" : "destructive"}>
            {accepted ? "consumed" : step === "redeeming" ? "scanning" : "not accepted"}
          </Badge>
        ) : null}
        <h1 className="text-2xl font-semibold">
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
              : (outcome?.reason ?? "This ticket cannot enter through this gate.")}
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
              className="min-h-16 rounded-md border border-white/10 bg-black/20 px-4 py-3 text-left transition hover:border-white/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="block text-sm text-muted-foreground">Ticket #{option.serial_number}</span>
              <span className="block font-medium">{option.category_name}</span>
            </button>
          ))}
        </div>
      ) : ticket ? (
        <div className="w-full rounded-md border border-white/10 bg-black/20 p-4">
          <p className="text-sm text-muted-foreground">Ticket #{ticket.serial_number}</p>
          <p className="mt-1 text-lg font-medium">{ticket.category_name}</p>
          <p className="mt-2 font-mono text-xs text-muted-foreground">
            {ticket.contract_address.slice(0, 10)}...#{ticket.token_id}
          </p>
        </div>
      ) : null}
    </section>
  );
}
