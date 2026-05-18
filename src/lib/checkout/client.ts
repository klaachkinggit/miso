"use client";

import { toast } from "@/components/ui/use-toast";

export async function redirectToCheckout(args: {
  endpoint: string;
  body: Record<string, unknown>;
  errorTitle?: string;
}): Promise<boolean> {
  try {
    const response = await fetch(args.endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "idempotency-key": crypto.randomUUID(),
      },
      body: JSON.stringify(args.body),
    });

    if (response.status === 401) {
      window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
      return true;
    }

    const payload = (await response.json()) as { url?: string; error?: string };
    if (!response.ok || !payload.url) {
      throw new Error(payload.error ?? "Checkout could not be started.");
    }
    window.location.href = payload.url;
    return true;
  } catch (error) {
    toast({
      title: args.errorTitle ?? "Checkout failed",
      description: error instanceof Error ? error.message : "Please try again.",
      variant: "destructive",
    });
    return false;
  }
}
