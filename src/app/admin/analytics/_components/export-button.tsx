"use client";

import { Download } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useState } from "react";

interface ExportButtonProps {
  organizationId: string;
  organizationSlug: string;
}

export function ExportButton({ organizationId, organizationSlug }: ExportButtonProps) {
  const params = useSearchParams();
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/analytics/export?${params.toString()}`, {
        method: "GET",
        headers: { "x-organization-id": organizationId },
      });
      if (!res.ok) throw new Error(`Export failed (${res.status})`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${organizationSlug}-analytics.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={run}
      disabled={busy}
      className="inline-flex items-center gap-2 rounded-md border border-hairline px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-ink-soft disabled:opacity-60"
    >
      <Download className="h-4 w-4" />
      {busy ? "Preparing CSV..." : "Export CSV"}
    </button>
  );
}
