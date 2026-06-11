import type { AnalyticsCategoryBreakdownRow } from "@/lib/analytics/organization";
import { formatPrice } from "@/lib/format";

interface CategoryTableProps {
  rows: AnalyticsCategoryBreakdownRow[];
}

export function CategoryTable({ rows }: CategoryTableProps) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No category data in this scope.</p>
    );
  }
  const maxRevenue = Math.max(1, ...rows.map((r) => r.revenue));
  return (
    <ol className="space-y-3">
      {rows.map((row) => {
        const widthPct = (row.revenue / maxRevenue) * 100;
        return (
          <li key={row.category_id} className="space-y-1.5">
            <div className="flex items-baseline justify-between text-sm">
              <span className="truncate text-foreground">{row.name}</span>
              <span className="ml-4 shrink-0 text-muted-foreground">
                {formatPrice(row.revenue, row.currency)} · {row.tickets_sold} sold
              </span>
            </div>
            <div className="relative h-2 overflow-hidden rounded-full bg-hairline">
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-signal/60"
                style={{ width: `${widthPct}%` }}
              />
            </div>
          </li>
        );
      })}
    </ol>
  );
}
