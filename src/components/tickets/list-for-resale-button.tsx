"use client";

import { useState } from "react";
import { Loader2, Tag, X } from "lucide-react";
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
      toast({ title: "Ticket listed", description: "Your ticket is now on the marketplace." });
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
          List for resale
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>List ticket for resale</DialogTitle>
          <DialogDescription>
            Sale routes through the Miso treasury. The NFT transfers to the buyer after payment.
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
            <p className="text-xs text-muted-foreground">Max resale price: {maxLabel}</p>
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
