"use client";

import { useState } from "react";
import { CheckCircle2, FileCheck2, Loader2, Wallet2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/ui/use-toast";

type Step = "idle" | "preparing" | "confirming" | "done" | "error";

interface TicketOption {
  id: string;
  serial_number: number;
  category_name: string;
  contract_address: string;
  token_id: number;
}

interface PreparedPayload {
  type: "miso.redeem";
  ticket: string;
  event: string;
  gate: string;
  nonce: string;
  contract: string;
  token_id: number;
  version: 2;
}

interface PrepareResponse {
  prepared: {
    payload: PreparedPayload;
    signer_wallet: string;
  };
  gate: { id: string; short_code: string; gate_name: string | null; event_id: string };
  ticket: { id: string; serial_number: number };
  error?: string;
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
  expectedSmartAccount: string;
}

export function RedeemPanel({ gateShortCode, tickets, expectedSmartAccount }: RedeemPanelProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("idle");
  const [prepared, setPrepared] = useState<PrepareResponse | null>(null);
  const [outcome, setOutcome] = useState<ConfirmResponse | null>(null);
  const busy = step === "preparing" || step === "confirming";

  async function start() {
    if (!selected) return;
    setStep("preparing");
    setOutcome(null);
    try {
      const prepRes = await fetch("/api/redeem/prepare", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ gate_short_code: gateShortCode, ticket_id: selected }),
      });
      const prep = (await prepRes.json()) as PrepareResponse;
      if (!prepRes.ok) throw new Error(prep.error ?? "Prepare failed");
      setPrepared(prep);

      setStep("confirming");
      const confRes = await fetch("/api/redeem/confirm", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ gate_short_code: gateShortCode, ticket_id: prep.ticket.id }),
      });
      const conf = (await confRes.json()) as ConfirmResponse;
      setOutcome(conf);
      setStep("done");
    } catch (error) {
      setStep("error");
      toast({
        title: "Redemption failed",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "destructive",
      });
    }
  }

  return (
    <div className="grid gap-6">
      <TicketPicker tickets={tickets} selected={selected} onSelect={setSelected} disabled={busy} />
      <ProofRequest
        gateShortCode={gateShortCode}
        tickets={tickets}
        selected={selected}
        expectedSmartAccount={expectedSmartAccount}
        prepared={prepared}
      />
      <Card className="glass rounded-lg">
        <CardContent className="grid gap-4 p-5">
          <Button onClick={start} disabled={!selected || busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet2 className="h-4 w-4" />}
            {step === "preparing"
              ? "Preparing…"
              : step === "confirming"
                ? "Redeeming on chain…"
                : "Redeem ticket"}
          </Button>
          <OutcomeBlock outcome={outcome} />
        </CardContent>
      </Card>
    </div>
  );
}

function TicketPicker({
  tickets,
  selected,
  onSelect,
  disabled,
}: {
  tickets: TicketOption[];
  selected: string | null;
  onSelect: (id: string) => void;
  disabled?: boolean;
}) {
  return (
    <Card className="glass rounded-lg">
      <CardHeader>
        <CardTitle>Choose a ticket</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        {tickets.map((ticket) => (
          <button
            key={ticket.id}
            type="button"
            onClick={() => onSelect(ticket.id)}
            disabled={disabled}
            className={`flex items-center justify-between rounded-md border p-4 text-left transition disabled:opacity-50 ${
              selected === ticket.id
                ? "border-primary bg-primary/10"
                : "border-border/60 hover:border-border"
            }`}
            aria-pressed={selected === ticket.id}
          >
            <div>
              <p className="text-sm text-muted-foreground">Ticket #{ticket.serial_number}</p>
              <p className="font-medium">{ticket.category_name}</p>
              <p className="mt-1 max-w-[18rem] truncate font-mono text-xs text-muted-foreground">
                {ticket.contract_address}#{ticket.token_id}
              </p>
            </div>
            <Badge variant={selected === ticket.id ? "success" : "secondary"}>
              {selected === ticket.id ? "Selected" : "Select"}
            </Badge>
          </button>
        ))}
      </CardContent>
    </Card>
  );
}

function short(value: string) {
  if (value.length <= 18) return value;
  return `${value.slice(0, 8)}…${value.slice(-6)}`;
}

function ProofRequest({
  gateShortCode,
  tickets,
  selected,
  expectedSmartAccount,
  prepared,
}: {
  gateShortCode: string;
  tickets: TicketOption[];
  selected: string | null;
  expectedSmartAccount: string;
  prepared: PrepareResponse | null;
}) {
  const ticket = tickets.find((option) => option.id === selected);
  const contract = prepared?.prepared.payload.contract ?? ticket?.contract_address ?? "Select a ticket";
  const tokenId = prepared?.prepared.payload.token_id ?? ticket?.token_id;
  const gate = prepared?.gate.short_code ?? gateShortCode;
  const nonce = prepared?.prepared.payload.nonce;

  return (
    <Card className="glass rounded-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileCheck2 className="h-5 w-5 text-primary" />
          Redemption intent
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 text-sm">
        <div className="grid grid-cols-[136px_1fr] gap-3">
          <span className="text-muted-foreground">Gate</span>
          <span className="font-mono">{gate}</span>
          <span className="text-muted-foreground">Smart account</span>
          <span className="truncate font-mono" title={expectedSmartAccount}>
            {short(expectedSmartAccount)}
          </span>
          <span className="text-muted-foreground">Contract</span>
          <span className="truncate font-mono" title={contract}>
            {short(contract)}
          </span>
          {tokenId !== undefined ? (
            <>
              <span className="text-muted-foreground">Token id</span>
              <span className="font-mono">{tokenId}</span>
            </>
          ) : null}
          {nonce ? (
            <>
              <span className="text-muted-foreground">Nonce</span>
              <span className="truncate font-mono" title={nonce}>
                {short(nonce)}
              </span>
            </>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function OutcomeBlock({ outcome }: { outcome: ConfirmResponse | null }) {
  if (!outcome) return null;
  const valid = outcome.result === "valid";
  return (
    <div className="rounded-md border border-border/70 p-4">
      <div className="flex items-center gap-2">
        {valid ? (
          <CheckCircle2 className="h-5 w-5 text-emerald-300" />
        ) : (
          <XCircle className="h-5 w-5 text-destructive" />
        )}
        <Badge variant={valid ? "success" : "destructive"}>{outcome.result}</Badge>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        {valid
          ? "Ticket redeemed. Show this screen to the controller."
          : (outcome.reason ?? "Redemption did not complete.")}
      </p>
      {outcome.redeem_tx_signature ? (
        <p className="mt-2 break-all text-xs text-muted-foreground">
          tx: {outcome.redeem_tx_signature}
        </p>
      ) : null}
    </div>
  );
}
