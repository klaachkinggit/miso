"use client";

import { useState } from "react";
import { Loader2, Send, Tag, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/use-toast";
import { formatPrice } from "@/lib/format";
import type { Currency } from "@/types/db";

export function ListForResaleButton({
  ticketId,
  currency,
  maxResalePrice,
  defaultPrice,
}: {
  ticketId: string;
  currency: Currency;
  maxResalePrice: number | null;
  defaultPrice: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [price, setPrice] = useState(String(defaultPrice));
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    try {
      const res = await fetch("/api/marketplace/listings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ticket_id: ticketId, price: Number(price) }),
      });
      const payload = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(payload.error ?? "Could not list ticket.");
      toast({ title: "Ticket listed", description: "Your NFT ticket is now on the official exchange." });
      setOpen(false);
      router.refresh();
    } catch (error) {
      toast({
        title: "Listing failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  const maxLabel = maxResalePrice ? formatPrice(maxResalePrice, currency) : null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline">
          <Tag className="h-4 w-4" />
          List ticket
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>List ticket</DialogTitle>
          <DialogDescription>
            The ticket routes through the MISO exchange and transfers after payment.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <Label htmlFor="resale-price">Price ({currency})</Label>
          <Input
            id="resale-price"
            type="number"
            step="0.01"
            min={0}
            value={price}
            onChange={(event) => setPrice(event.target.value)}
            disabled={loading}
          />
          {maxLabel ? (
            <p className="text-xs text-muted-foreground">Resale price limit: {maxLabel}</p>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={loading || !price}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            List
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function CancelListingButton({ listingId }: { listingId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function cancel() {
    setLoading(true);
    try {
      const res = await fetch(`/api/marketplace/listings/${listingId}`, {
        method: "DELETE",
      });
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(payload.error ?? "Could not cancel listing.");
      toast({ title: "Listing canceled" });
      router.refresh();
    } catch (error) {
      toast({
        title: "Cancel failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button type="button" variant="outline" onClick={cancel} disabled={loading}>
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
      Cancel listing
    </Button>
  );
}

export function TransferToWalletButton({ ticketId }: { ticketId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [address, setAddress] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!confirm) {
      toast({ title: "Confirmation required", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/tickets/transfer-to-wallet", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ticket_id: ticketId,
          destination_address: address,
        }),
      });
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(payload.error ?? "Could not transfer ticket.");
      toast({
        title: "Transfer submitted",
        description: "The NFT ticket is moving to your personal wallet.",
      });
      setOpen(false);
      router.refresh();
    } catch (error) {
      toast({
        title: "Transfer failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline">
          <Send className="h-4 w-4" />
          Transfer to wallet
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Transfer to personal wallet</DialogTitle>
          <DialogDescription>
            This sends the NFT ticket out of MISO custody. MISO cannot recover it,
            relist it, or control it after transfer.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <Label htmlFor="external-wallet">External EVM wallet address</Label>
          <Input
            id="external-wallet"
            placeholder="0x..."
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            disabled={loading}
          />
          <label className="flex items-start gap-3 text-sm text-muted-foreground">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4"
              checked={confirm}
              onChange={(event) => setConfirm(event.target.checked)}
              disabled={loading}
            />
            I understand this transfer is irreversible and only supported after
            the event has passed or the ticket has been consumed.
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={loading || !address || !confirm}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Transfer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
