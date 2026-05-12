"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Keyboard, ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    <div className="container flex min-h-[calc(100vh-4rem)] max-w-xl items-center py-10">
      <Card className="glass w-full rounded-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ScanLine className="h-5 w-5 text-primary" />
            Redeem gate entry
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="gate-code">Gate code</Label>
              <Input
                id="gate-code"
                value={code}
                onChange={(event) => setCode(event.target.value)}
                placeholder="ABCDEFGH"
                autoCapitalize="characters"
                autoComplete="off"
                className="font-mono uppercase tracking-[0.2em]"
              />
            </div>
            <Button type="submit" disabled={!code.trim()}>
              <Keyboard className="h-4 w-4" />
              Continue
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
