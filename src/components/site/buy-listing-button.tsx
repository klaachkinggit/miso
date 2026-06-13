"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";

export function BuyListingButton({
  listingId,
  disabled,
  reason,
}: {
  listingId: string;
  disabled?: boolean;
  reason?: string | null;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  function startCheckout() {
    setLoading(true);
    router.push(`/checkout/card?listing_id=${listingId}`);
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
