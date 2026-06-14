"use client";

import { useState, useTransition } from "react";
import { Check, Copy, Globe } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  setCustomDomainAction,
  verifyCustomDomainAction,
  type CustomDomainActionResult,
} from "@/app/smartboard/custom-domain-actions";

type Props = {
  customDomain: string | null;
  verified: boolean;
  verificationToken: string | null;
};

export function CustomDomainSettings({ customDomain, verified, verificationToken }: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // Local view of the pending verification record so the TXT instructions appear
  // immediately after setting a domain, without a full page reload.
  const [draft, setDraft] = useState<{ domain: string; token: string; txtRecordName: string } | null>(
    customDomain && verificationToken && !verified
      ? { domain: customDomain, token: verificationToken, txtRecordName: `_miso-verify.${customDomain}` }
      : null,
  );
  const [isVerified, setIsVerified] = useState(verified);

  function handleResult(result: CustomDomainActionResult) {
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError(null);
    if (typeof result.verified === "boolean") {
      setIsVerified(result.verified);
      if (result.verified) setDraft(null);
      else if (!result.verified) setError("Domain not verified yet — add the TXT record and try again.");
      return;
    }
    setIsVerified(false);
    setDraft({ domain: result.domain, token: result.token, txtRecordName: result.txtRecordName });
  }

  function onSet(formData: FormData) {
    setError(null);
    startTransition(async () => handleResult(await setCustomDomainAction(formData)));
  }

  function onVerify() {
    setError(null);
    startTransition(async () => handleResult(await verifyCustomDomainAction()));
  }

  const activeDomain = draft?.domain ?? customDomain;

  return (
    <Card className="glass rounded-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="h-5 w-5 text-primary" />
          Custom domain
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 text-sm text-muted-foreground">
        {activeDomain ? (
          <div className="flex items-center justify-between rounded-md border border-border/70 p-3">
            <span className="font-mono text-foreground">{activeDomain}</span>
            <Badge variant={isVerified ? "success" : "warning"}>
              {isVerified ? "Verified" : "Pending verification"}
            </Badge>
          </div>
        ) : null}

        {error ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-destructive-foreground">
            {error}
          </div>
        ) : null}

        <form action={onSet} className="grid gap-3">
          <div className="grid gap-2">
            <Label htmlFor="custom_domain">Domain</Label>
            <Input
              id="custom_domain"
              name="domain"
              placeholder="tickets.example.com"
              defaultValue={customDomain ?? ""}
              required
            />
          </div>
          <Button type="submit" disabled={pending}>
            {customDomain ? "Update domain" : "Set domain"}
          </Button>
        </form>

        {draft && !isVerified ? (
          <div className="grid gap-3 rounded-md border border-border/70 bg-secondary/30 p-3">
            <p className="text-foreground">
              Add this DNS TXT record at your domain provider, then verify:
            </p>
            <CopyRow label="Record name" value={draft.txtRecordName} />
            <CopyRow label="Type" value="TXT" />
            <CopyRow label="Value" value={draft.token} />
            <Button type="button" variant="outline" onClick={onVerify} disabled={pending}>
              Verify
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function CopyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <div className="grid gap-1">
      <span className="text-[11px] uppercase tracking-[0.16em]">{label}</span>
      <div className="flex items-start gap-2">
        <code className="min-w-0 flex-1 overflow-x-auto rounded-md border border-border/70 bg-background px-3 py-2 font-mono text-xs">
          {value}
        </code>
        <Button type="button" variant="outline" size="sm" onClick={copy}>
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}
