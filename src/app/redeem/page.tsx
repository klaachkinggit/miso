"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Keyboard, ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function RedeemCodePage() {
  const router = useRouter();
  const [code, setCode] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = code.trim().toUpperCase().replace(/\s+/g, "");
    if (!normalized) return;
    router.push(`/redeem/${encodeURIComponent(normalized)}`);
  }

  return (
    <div className="container flex min-h-[calc(100vh-4rem)] max-w-xl items-center py-12">
      <div className="w-full rounded-md border border-hairline bg-ink-raised">
        <div className="border-b border-hairline px-6 py-5">
          <p className="eyebrow-signal flex items-center gap-2">
            <ScanLine className="h-3.5 w-3.5" />
            Door entry
          </p>
          <h1 className="display mt-3 text-2xl text-foreground md:text-3xl">
            Redeem gate code<span className="display-italic">.</span>
          </h1>
        </div>
        <form onSubmit={submit} className="grid gap-5 p-6">
          <div className="grid gap-2">
            <Label htmlFor="gate-code">Gate code</Label>
            <Input
              id="gate-code"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder="ABCDEFGH"
              autoCapitalize="characters"
              autoComplete="off"
              className="font-mono uppercase tracking-[0.24em]"
            />
          </div>
          <Button type="submit" disabled={!code.trim()}>
            <Keyboard className="h-4 w-4" />
            Continue
          </Button>
        </form>
      </div>
    </div>
  );
}
