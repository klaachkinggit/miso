"use client";

import { Download } from "lucide-react";
import { useSearchParams } from "next/navigation";

export function ExportButton() {
  const params = useSearchParams();

  return (
    <a
      href={`/api/analytics/export?${params.toString()}`}
      download
      className="inline-flex items-center gap-2 rounded-md border border-hairline px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-ink-soft"
    >
      <Download className="h-4 w-4" />
      Export CSV
    </a>
  );
}
