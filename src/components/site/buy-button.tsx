"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Gift, Loader2, Minus, Plus, ShoppingCart } from "lucide-react";
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

const giftEmailStorageKey = (categoryId: string) =>
  `miso:checkout:gift:${categoryId}`;

export interface BuyButtonCategory {
  id: string;
  kind: "standard" | "club_table";
  currency: "EUR";
  price: number | string;
  online_advance: number | string | null;
  extra_guests_enabled: boolean;
  price_per_extra_guest: number | string | null;
  max_extra_guests: number | null;
  base_capacity: number | null;
}

export function BuyButton({
  category,
  disabled,
  reason,
  returnPath,
}: {
  category: BuyButtonCategory;
  disabled?: boolean;
  reason?: string | null;
  returnPath?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [extras, setExtras] = useState(0);
  const [isGift, setIsGift] = useState(false);
  const [giftEmail, setGiftEmail] = useState("");
  const [promo, setPromo] = useState("");

  const isClub = category.kind === "club_table";
  const advance = Number(category.online_advance ?? category.price ?? 0);
  const extraPrice = Number(category.price_per_extra_guest ?? 0);
  const maxExtras = category.max_extra_guests ?? 0;
  const allowExtras = isClub && category.extra_guests_enabled && maxExtras > 0;
  const basePrice = Number(category.price ?? 0);

  const onlineTotal = useMemo(() => {
    if (isClub) return (advance + extras * extraPrice) * quantity;
    return basePrice * quantity;
  }, [advance, basePrice, extras, extraPrice, isClub, quantity]);

  function submit() {
    if (isGift && !giftEmail) {
      toast({ title: "Friend's email required", variant: "destructive" });
      return;
    }
    setLoading(true);
    const params = new URLSearchParams({ category_id: category.id });
    if (quantity !== 1) params.set("quantity", String(quantity));
    if (extras > 0) params.set("extra_guests", String(extras));
    if (isGift && giftEmail) {
      window.sessionStorage.setItem(
        giftEmailStorageKey(category.id),
        giftEmail,
      );
    } else {
      window.sessionStorage.removeItem(giftEmailStorageKey(category.id));
    }
    if (promo.trim()) params.set("promo", promo.trim());
    if (returnPath) params.set("return_path", returnPath);
    router.push(`/checkout/card?${params.toString()}`);
  }

  return (
    <div className="space-y-2">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button
            type="button"
            disabled={disabled}
            className="w-full sm:w-auto"
          >
            <ShoppingCart className="h-4 w-4" />
            {isClub ? "Book table" : "Get ticket"}
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {isClub ? "Book this table" : "Buy this ticket"}
            </DialogTitle>
            <DialogDescription>
              {isClub
                ? "Pay an advance now to secure the table. Remaining minimum spending is due at the venue."
                : "You will be redirected to Stripe to complete payment."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-2 rounded-md border border-border/70 p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Quantity</p>
                <p className="text-xs text-muted-foreground">
                  {isClub ? "Number of tables" : "Number of tickets"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setQuantity((v) => Math.max(1, v - 1))}
                  disabled={quantity <= 1}
                  aria-label="Decrease ticket quantity"
                >
                  <Minus aria-hidden="true" className="h-4 w-4" />
                </Button>
                <span className="w-6 text-center font-mono">{quantity}</span>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setQuantity((v) => Math.min(10, v + 1))}
                  disabled={quantity >= 10}
                  aria-label="Increase ticket quantity"
                >
                  <Plus aria-hidden="true" className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {allowExtras ? (
            <div className="grid gap-2 rounded-md border border-border/70 p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Extra guests</p>
                  <p className="text-xs text-muted-foreground">
                    Base table includes {category.base_capacity} guests.{" "}
                    {formatPrice(extraPrice, category.currency)} per extra (max{" "}
                    {maxExtras}).
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setExtras((v) => Math.max(0, v - 1))}
                    disabled={extras === 0}
                    aria-label="Decrease extra guests"
                  >
                    <Minus aria-hidden="true" className="h-4 w-4" />
                  </Button>
                  <span className="w-6 text-center font-mono">{extras}</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setExtras((v) => Math.min(maxExtras, v + 1))}
                    disabled={extras >= maxExtras}
                    aria-label="Increase extra guests"
                  >
                    <Plus aria-hidden="true" className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ) : null}

          <div className="grid gap-2 rounded-md border border-border/70 p-3">
            <label className="flex items-center gap-3 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={isGift}
                onChange={(e) => setIsGift(e.target.checked)}
              />
              <Gift className="h-4 w-4 text-primary" />
              This ticket is a gift for a friend
            </label>
            {isGift ? (
              <div className="grid gap-1">
                <Label htmlFor="gift_email">
                  Friend&rsquo;s MISO account email
                </Label>
                <Input
                  id="gift_email"
                  name="gift_recipient_email"
                  type="email"
                  autoComplete="email"
                  placeholder="friend@example.com"
                  value={giftEmail}
                  onChange={(e) => setGiftEmail(e.target.value)}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Must match an existing MISO account. The digital ticket is
                  issued directly to them.
                </p>
              </div>
            ) : null}
          </div>

          <div className="grid gap-1 rounded-md border border-border/70 p-3">
            <Label htmlFor="promo_code">Promo code (optional)</Label>
            <Input
              id="promo_code"
              name="promo"
              autoComplete="off"
              placeholder="EARLYBIRD"
              value={promo}
              onChange={(e) => setPromo(e.target.value)}
            />
          </div>

          <div className="rounded-md bg-secondary/40 p-3 text-sm">
            <div className="flex items-center justify-between border-b border-border/60 pb-2">
              <span className="text-muted-foreground">You pay online</span>
              <span className="text-lg font-semibold">
                {formatPrice(onlineTotal, category.currency)}
              </span>
            </div>
            {isClub ? (
              <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                <span>Remaining minimum spending due at the venue</span>
                <span>
                  {formatPrice(
                    Math.max(0, basePrice * quantity - onlineTotal),
                    category.currency,
                  )}
                </span>
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="button" onClick={submit} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Continue to payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {disabled && reason ? (
        <p className="text-center text-xs text-muted-foreground sm:text-right">
          {reason}
        </p>
      ) : null}
    </div>
  );
}
