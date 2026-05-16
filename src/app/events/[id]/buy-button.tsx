"use client";

import { useState } from "react";
import { Loader2, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";

export function BuyButton({
  categoryId,
  disabled,
  reason,
}: {
  categoryId: string;
  disabled?: boolean;
  reason?: string | null;
}) {
  const [loading, setLoading] = useState(false);

  async function startCheckout() {
    setLoading(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ category_id: categoryId }),
      });

      if (res.status === 401) {
        window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
        return;
      }

      const payload = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !payload.url) {
        throw new Error(payload.error ?? "Checkout could not be started.");
      }
      window.location.href = payload.url;
    } catch (error) {
      toast({
        title: "Checkout failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button type="button" onClick={startCheckout} disabled={disabled || loading} className="w-full sm:w-auto">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShoppingCart className="h-4 w-4" />}
        Get ticket
      </Button>
      {disabled && reason ? (
        <p className="text-center text-xs text-muted-foreground sm:text-right">{reason}</p>
      ) : null}
    </div>
  );
}
