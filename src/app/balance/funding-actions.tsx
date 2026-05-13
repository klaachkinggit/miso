"use client";

import { useState } from "react";
import { ArrowDownToLine, ArrowUpFromLine, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";

async function callUnavailableFundingRoute(path: string) {
  const response = await fetch(path, { method: "POST" });
  const payload = (await response.json()) as { error?: string };
  throw new Error(payload.error ?? "This feature is not implemented yet.");
}

export function FundingActions() {
  const [loading, setLoading] = useState<"charge" | "cashout" | null>(null);

  async function run(action: "charge" | "cashout") {
    setLoading(action);
    try {
      await callUnavailableFundingRoute(`/api/balance/${action}`);
    } catch (error) {
      toast({
        title: action === "charge" ? "Charge not available" : "Cashout not available",
        description: error instanceof Error ? error.message : "This feature is not implemented yet.",
        variant: "destructive",
      });
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <Button type="button" variant="outline" onClick={() => run("charge")} disabled={loading !== null}>
        {loading === "charge" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowDownToLine className="h-4 w-4" />}
        Charge
      </Button>
      <Button type="button" variant="outline" onClick={() => run("cashout")} disabled={loading !== null}>
        {loading === "cashout" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUpFromLine className="h-4 w-4" />}
        Cashout
      </Button>
    </div>
  );
}
