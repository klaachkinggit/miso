import { notFound, redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/site/empty-state";
import { getCurrentUser } from "@/lib/auth";
import { getGateSessionByShortCode, isGateSessionUsable } from "@/lib/gates/session";
import { createServiceClient } from "@/lib/supabase/service";
import { formatDate } from "@/lib/format";
import type { EventRow, Ticket, TicketCategory, Wallet } from "@/types/db";
import { RedeemPanel } from "./redeem-panel";

export default async function RedeemPage({ params }: { params: Promise<{ shortCode: string }> }) {
  const { shortCode } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/redeem/${shortCode}`);

  const gate = await getGateSessionByShortCode(shortCode);
  if (!gate) notFound();

  const sb = createServiceClient();
  const { data: event } = await sb
    .from("events")
    .select("*")
    .eq("id", gate.event_id)
    .single<EventRow>();
  if (!event) notFound();

  const usable = isGateSessionUsable(gate);

  const { data: tickets } = await sb
    .from("tickets")
    .select("*")
    .eq("event_id", gate.event_id)
    .eq("owner_user_id", user.id)
    .order("serial_number", { ascending: true })
    .returns<Ticket[]>();

  const categoryIds = [...new Set(tickets?.map((t) => t.category_id) ?? [])];
  const { data: categories } = categoryIds.length
    ? await sb.from("ticket_categories").select("*").in("id", categoryIds).returns<TicketCategory[]>()
    : { data: [] as TicketCategory[] };
  const categoryById = new Map((categories ?? []).map((c) => [c.id, c]));

  const eligible = (tickets ?? []).filter((t) => t.status === "sold");
  const ineligible = (tickets ?? []).filter((t) => !eligible.some((eligibleTicket) => eligibleTicket.id === t.id));

  const { data: wallet } = await sb
    .from("wallets")
    .select("wallet_address, wallet_type")
    .eq("user_id", user.id)
    .eq("is_primary", true)
    .maybeSingle<Pick<Wallet, "wallet_address" | "wallet_type">>();

  return (
    <div className="container max-w-3xl py-10">
      <header className="mb-8">
        <Badge variant={usable ? "success" : "destructive"}>{usable ? "Gate open" : `Gate ${gate.status}`}</Badge>
        <h1 className="mt-3 text-3xl font-semibold">Redeem entry</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {event.name} · {formatDate(event.date)} · {event.venue_name}, {event.city}
          {gate.gate_name ? ` · ${gate.gate_name}` : ""}
        </p>
      </header>

      {!usable ? (
        <Card className="glass rounded-lg">
          <CardContent className="p-6 text-sm text-muted-foreground">
            This gate is no longer accepting redemptions. Ask the controller to open a new one.
          </CardContent>
        </Card>
      ) : eligible.length === 0 ? (
        <EmptyState
          title="No eligible tickets"
          description={
            ineligible.length
              ? "You hold tickets for this event but none are currently eligible (already used, refunded, or not yet paid)."
              : "You don't own a ticket for this event."
          }
        />
      ) : !wallet ? (
        <EmptyState
          title="No wallet"
          description="You must complete a purchase before you can redeem — that creates the wallet that holds the ticket."
        />
      ) : (
        <RedeemPanel
          gateShortCode={gate.short_code}
          walletType={wallet.wallet_type}
          expectedWalletAddress={wallet.wallet_address}
          tickets={eligible.map((ticket) => ({
            id: ticket.id,
            serial_number: ticket.serial_number,
            category_name: categoryById.get(ticket.category_id)?.name ?? "Ticket",
            asset_address: ticket.nft_asset_address ?? `demo_asset_${ticket.id}`,
          }))}
        />
      )}
    </div>
  );
}
