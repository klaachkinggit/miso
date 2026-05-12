"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, FileCheck2, Loader2, Wallet2, XCircle } from "lucide-react";
import { Connection, Transaction } from "@solana/web3.js";
import {
  ConnectionProvider,
  WalletProvider,
  useConnection,
  useWallet,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider, WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
} from "@solana/wallet-adapter-wallets";
import "@solana/wallet-adapter-react-ui/styles.css";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/ui/use-toast";

type Step = "idle" | "preparing" | "wallet-signing" | "submitting" | "confirming" | "done" | "error";

interface TicketOption {
  id: string;
  serial_number: number;
  category_name: string;
  asset_address: string;
}

interface PreparedPayload {
  type: "miso.redeem";
  ticket: string;
  event: string;
  gate: string;
  nonce: string;
  asset: string;
  version: 1;
}

interface PrepareResponse {
  prepared: {
    serialized_tx_b64: string;
    payload: PreparedPayload;
    redemption_pda: string;
    recent_blockhash: string;
    signer_wallet: string;
    tx_signature?: string;
    signed?: boolean;
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
  walletType: "custodial" | "external";
  expectedWalletAddress: string;
}

export function RedeemPanel(props: RedeemPanelProps) {
  const endpoint = useMemo(
    () => process.env.NEXT_PUBLIC_SOLANA_RPC ?? "https://api.devnet.solana.com",
    []
  );

  if (props.walletType === "custodial") {
    // Custodial flow needs no wallet provider — backend signs.
    return <CustodialPanel {...props} />;
  }

  const wallets = [new PhantomWalletAdapter(), new SolflareWalletAdapter()];
  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <ExternalPanel {...props} />
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

function useRedeemBase(gateShortCode: string) {
  const [selected, setSelected] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("idle");
  const [prepared, setPrepared] = useState<PrepareResponse | null>(null);
  const [outcome, setOutcome] = useState<ConfirmResponse | null>(null);

  async function prepare(ticketId: string): Promise<PrepareResponse> {
    const res = await fetch("/api/redeem/prepare", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ gate_short_code: gateShortCode, ticket_id: ticketId }),
    });
    const payload = (await res.json()) as PrepareResponse;
    if (!res.ok) throw new Error(payload.error ?? "Prepare failed");
    setPrepared(payload);
    return payload;
  }

  async function confirm(payload: PrepareResponse, txSignature: string) {
    setStep("confirming");
    const res = await fetch("/api/redeem/confirm", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        gate_short_code: gateShortCode,
        ticket_id: payload.ticket.id,
        tx_signature: txSignature,
        signer_wallet: payload.prepared.signer_wallet,
        nonce: payload.prepared.payload.nonce,
      }),
    });
    const data = (await res.json()) as ConfirmResponse;
    setOutcome(data);
    setStep("done");
    return data;
  }

  return {
    selected,
    setSelected,
    step,
    setStep,
    prepared,
    outcome,
    prepare,
    confirm,
    reset: () => {
      setPrepared(null);
      setOutcome(null);
      setStep("idle");
    },
  };
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
              <p className="mt-1 max-w-[15rem] truncate font-mono text-xs text-muted-foreground">
                {ticket.asset_address}
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
  expectedWalletAddress,
  prepared,
}: {
  gateShortCode: string;
  tickets: TicketOption[];
  selected: string | null;
  expectedWalletAddress: string;
  prepared: PrepareResponse | null;
}) {
  const ticket = tickets.find((option) => option.id === selected);
  const assetAddress = prepared?.prepared.payload.asset ?? ticket?.asset_address ?? "Select a ticket";
  const gate = prepared?.gate.short_code ?? gateShortCode;
  const nonce = prepared?.prepared.payload.nonce;

  return (
    <Card className="glass rounded-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileCheck2 className="h-5 w-5 text-primary" />
          Proof request
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 text-sm">
        <div className="grid grid-cols-[112px_1fr] gap-3">
          <span className="text-muted-foreground">Gate</span>
          <span className="font-mono">{gate}</span>
          <span className="text-muted-foreground">Owner wallet</span>
          <span className="truncate font-mono" title={expectedWalletAddress}>{short(expectedWalletAddress)}</span>
          <span className="text-muted-foreground">Ticket NFT</span>
          <span className="truncate font-mono" title={assetAddress}>{short(assetAddress)}</span>
          {nonce ? (
            <>
              <span className="text-muted-foreground">Nonce</span>
              <span className="truncate font-mono" title={nonce}>{short(nonce)}</span>
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
          : outcome.reason ?? "Redemption did not complete."}
      </p>
      {outcome.redeem_tx_signature ? (
        <p className="mt-2 break-all text-xs text-muted-foreground">
          tx: {outcome.redeem_tx_signature}
        </p>
      ) : null}
    </div>
  );
}

function CustodialPanel({ gateShortCode, tickets, expectedWalletAddress }: RedeemPanelProps) {
  const base = useRedeemBase(gateShortCode);
  const busy = base.step === "preparing" || base.step === "confirming";

  async function start() {
    if (!base.selected) return;
    base.setStep("preparing");
    try {
      const payload = await base.prepare(base.selected);
      if (payload.prepared.signed && payload.prepared.tx_signature) {
        await base.confirm(payload, payload.prepared.tx_signature);
      } else {
        throw new Error("Custodial backend did not return signed tx");
      }
    } catch (error) {
      base.setStep("error");
      toast({
        title: "Redemption failed",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "destructive",
      });
    }
  }

  return (
    <div className="grid gap-6">
      <TicketPicker
        tickets={tickets}
        selected={base.selected}
        onSelect={base.setSelected}
        disabled={busy}
      />
      <ProofRequest
        gateShortCode={gateShortCode}
        tickets={tickets}
        selected={base.selected}
        expectedWalletAddress={expectedWalletAddress}
        prepared={base.prepared}
      />
      <Card className="glass rounded-lg">
        <CardContent className="grid gap-4 p-5">
          <Button onClick={start} disabled={!base.selected || busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet2 className="h-4 w-4" />}
            {base.step === "preparing"
              ? "Preparing proof…"
              : base.step === "confirming"
              ? "Verifying proof…"
              : "Sign proof & redeem"}
          </Button>
          <OutcomeBlock outcome={base.outcome} />
        </CardContent>
      </Card>
    </div>
  );
}

function ExternalPanel({ gateShortCode, tickets, expectedWalletAddress }: RedeemPanelProps) {
  const base = useRedeemBase(gateShortCode);
  const { publicKey, connected, signTransaction } = useWallet();
  const { connection } = useConnection();
  const connectedAddress = publicKey?.toBase58();
  const walletMatches = connectedAddress === expectedWalletAddress;

  const busy =
    base.step === "preparing" ||
    base.step === "wallet-signing" ||
    base.step === "submitting" ||
    base.step === "confirming";

  async function start() {
    if (!base.selected) return;
    if (!connected || !publicKey || !signTransaction) {
      toast({ title: "Connect your wallet first", variant: "destructive" });
      return;
    }
    if (!walletMatches) {
      toast({
        title: "Wrong wallet",
        description: `Connect ${expectedWalletAddress.slice(0, 6)}…${expectedWalletAddress.slice(-4)}`,
        variant: "destructive",
      });
      return;
    }

    base.setStep("preparing");
    try {
      const payload = await base.prepare(base.selected);

      // Custodial users would short-circuit; for external the backend returns
      // an unsigned serialized tx.
      if (payload.prepared.signed && payload.prepared.tx_signature) {
        await base.confirm(payload, payload.prepared.tx_signature);
        return;
      }
      if (!payload.prepared.serialized_tx_b64) {
        throw new Error("Backend did not return an unsigned transaction");
      }

      base.setStep("wallet-signing");
      const buf = Uint8Array.from(atob(payload.prepared.serialized_tx_b64), (c) => c.charCodeAt(0));
      const tx = Transaction.from(buf);
      const signed = await signTransaction(tx);

      base.setStep("submitting");
      const sig = await sendAndConfirm(connection, signed.serialize());
      await base.confirm(payload, sig);
    } catch (error) {
      base.setStep("error");
      toast({
        title: "Redemption failed",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "destructive",
      });
    }
  }

  return (
    <div className="grid gap-6">
      <Card className="glass rounded-lg">
        <CardHeader>
          <CardTitle>Wallet</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          <WalletMultiButton />
          {connected ? (
            <p className={`text-xs ${walletMatches ? "text-muted-foreground" : "text-destructive"}`}>
              Connected: <span className="font-mono">{connectedAddress?.slice(0, 8)}…{connectedAddress?.slice(-4)}</span>
              {!walletMatches ? (
                <>
                  {" "}
                  — does not match the ticket owner wallet
                  <span className="ml-1 font-mono">
                    {expectedWalletAddress.slice(0, 6)}…{expectedWalletAddress.slice(-4)}
                  </span>
                  .
                </>
              ) : null}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Connect the wallet that holds this ticket: {expectedWalletAddress.slice(0, 8)}…{expectedWalletAddress.slice(-4)}
            </p>
          )}
        </CardContent>
      </Card>

      <TicketPicker
        tickets={tickets}
        selected={base.selected}
        onSelect={base.setSelected}
        disabled={busy}
      />
      <ProofRequest
        gateShortCode={gateShortCode}
        tickets={tickets}
        selected={base.selected}
        expectedWalletAddress={expectedWalletAddress}
        prepared={base.prepared}
      />

      <Card className="glass rounded-lg">
        <CardContent className="grid gap-4 p-5">
          <Button onClick={start} disabled={!base.selected || busy || !connected || !walletMatches}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet2 className="h-4 w-4" />}
            {base.step === "preparing"
              ? "Preparing proof…"
              : base.step === "wallet-signing"
              ? "Approve in wallet…"
              : base.step === "submitting"
              ? "Submitting…"
              : base.step === "confirming"
              ? "Verifying proof…"
              : "Sign proof & redeem"}
          </Button>
          <OutcomeBlock outcome={base.outcome} />
        </CardContent>
      </Card>
    </div>
  );
}

async function sendAndConfirm(connection: Connection, raw: Uint8Array): Promise<string> {
  const sig = await connection.sendRawTransaction(raw, { skipPreflight: false });
  const latest = await connection.getLatestBlockhash("confirmed");
  await connection.confirmTransaction(
    { signature: sig, blockhash: latest.blockhash, lastValidBlockHeight: latest.lastValidBlockHeight },
    "confirmed"
  );
  return sig;
}
