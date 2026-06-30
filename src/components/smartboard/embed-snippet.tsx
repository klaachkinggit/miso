"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";

export function EmbedSnippet({ snippet }: { snippet: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(snippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex items-start gap-2">
      <code className="min-w-0 flex-1 overflow-x-auto rounded-md border border-border/70 bg-secondary/40 px-3 py-2 font-mono text-xs">
        {snippet}
      </code>
      <Button type="button" variant="outline" size="sm" onClick={copy}>
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        {copied ? "Copied" : "Copy"}
      </Button>
    </div>
  );
}
