"use client";

import { useState } from "react";
import { Loader2, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { redirectToCheckout } from "@/lib/checkout/client";

export function BuyListingButton({
  listingId,
  disabled,
  reason,
}: {
  listingId: string;
  disabled?: boolean;
  reason?: string | null;
}) {
  const [loading, setLoading] = useState(false);

  async function startCheckout() {
    setLoading(true);
    const redirected = await redirectToCheckout({
      endpoint: "/api/marketplace/checkout",
      body: { listing_id: listingId },
    });
    if (!redirected) {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        onClick={startCheckout}
        disabled={disabled || loading}
        className="w-full"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShoppingCart className="h-4 w-4" />}
        Buy ticket
      </Button>
      {disabled && reason ? (
        <p className="text-center text-xs text-muted-foreground">{reason}</p>
      ) : null}
    </div>
  );
}
