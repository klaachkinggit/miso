import type { AnalyticsChannelStat } from "@/lib/analytics/organization";
import { formatPrice } from "@/lib/format";
import type { Currency } from "@/types/db";

const CHANNEL_LABEL: Record<string, string> = {
  mini_site: "Primary mini-site",
  marketplace: "Marketplace",
  qr: "QR",
  widget: "Embed widget",
  ticket_office: "Ticket office",
  invitation: "Invitation",
  import: "Import",
};

interface ChannelBarsProps {
  channels: AnalyticsChannelStat[];
  currency: Currency;
}

export function ChannelBars({ channels, currency }: ChannelBarsProps) {
  if (channels.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No paid purchases in this period.
      </p>
    );
  }
  const max = Math.max(...channels.map((c) => c.revenue));
  return (
    <ol className="space-y-3">
      {channels.map((channel) => {
        const widthPct = max > 0 ? (channel.revenue / max) * 100 : 0;
        return (
          <li key={channel.channel} className="space-y-1.5">
            <div className="flex items-baseline justify-between text-sm">
              <span className="text-foreground">
                {CHANNEL_LABEL[channel.channel] ?? channel.channel}
              </span>
              <span className="text-muted-foreground">
                {formatPrice(channel.revenue, currency)} ·{" "}
                {Math.round(channel.share * 100)}%
              </span>
            </div>
            <div className="relative h-2 overflow-hidden rounded-full bg-hairline">
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-signal/80"
                style={{ width: `${widthPct}%` }}
              />
            </div>
          </li>
        );
      })}
    </ol>
  );
}
