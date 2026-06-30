import { notFound, redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { getCurrentUser } from "@/lib/auth";
import {
  getGateSessionByShortCode,
  isGateSessionUsable,
} from "@/lib/gates/operations";
import { createServiceClient } from "@/lib/supabase/service";
import { formatDate } from "@/lib/format";
import type { EventRow, Ticket, TicketCategory } from "@/types/db";
import { RedeemPanel } from "./redeem-panel";

export default async function RedeemPage({
  params,
  searchParams,
}: {
  params: Promise<{ shortCode: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  const [{ shortCode }, { t: token }, user] = await Promise.all([
    params,
    searchParams,
    getCurrentUser(),
  ]);
  if (!user) redirect(`/login?next=/redeem/${shortCode}`);

  const gate = await getGateSessionByShortCode(shortCode);
  if (!gate) notFound();

  const sb = createServiceClient();
  const usable = isGateSessionUsable(gate);

  const [{ data: event }, { data: tickets }] = await Promise.all([
    sb.from("events").select("*").eq("id", gate.event_id).single<EventRow>(),
    sb
      .from("tickets")
      .select("*")
      .eq("event_id", gate.event_id)
      .eq("owner_user_id", user.id)
      .order("serial_number", { ascending: true })
      .returns<Ticket[]>(),
  ]);

  if (!event) notFound();

  const categoryIds = [...new Set(tickets?.map((t) => t.category_id) ?? [])];
  const { data: categories } = categoryIds.length
    ? await sb
        .from("ticket_categories")
        .select("*")
        .in("id", categoryIds)
        .returns<TicketCategory[]>()
    : { data: [] as TicketCategory[] };
  const categoryById = new Map((categories ?? []).map((c) => [c.id, c]));
  const scopedCategoryIds = new Set(gate.allowed_category_ids ?? []);
  const gateAcceptsCategory = (categoryId: string) =>
    scopedCategoryIds.size === 0 || scopedCategoryIds.has(categoryId);

  const acceptedTickets = (tickets ?? []).filter((ticket) =>
    gateAcceptsCategory(ticket.category_id),
  );
  const eligible = acceptedTickets.filter(
    (t) =>
      t.status === "sold" &&
      t.nft_contract_address !== null &&
      t.nft_token_id !== null &&
      gateAcceptsCategory(t.category_id),
  );
  const consumedTicket = acceptedTickets.find(
    (ticket) => ticket.status === "used",
  );
  const ownsAcceptedCategory = acceptedTickets.length > 0;
  const noEligibleDescription = !(tickets ?? []).length
    ? scopedCategoryIds.size > 0
      ? "You don't own a ticket category accepted by this gate."
      : "You don't own a ticket for this event."
    : scopedCategoryIds.size > 0 && !ownsAcceptedCategory
      ? "Your tickets are not in a category accepted by this gate."
      : consumedTicket
        ? `Ticket #${consumedTicket.serial_number} is already consumed.`
        : "You hold tickets for this event but none are currently eligible.";

  return (
    <div className="container grid min-h-[calc(100vh-8rem)] content-center py-8">
      <header className="mx-auto mb-8 max-w-sm text-center">
        <Badge variant={usable ? "signal" : "destructive"}>
          {usable ? "Gate open" : `Gate ${gate.status}`}
        </Badge>
        <h1 className="display mt-4 text-3xl text-foreground md:text-4xl">
          Entry scan<span className="display-italic">.</span>
        </h1>
        <p className="mt-3 text-xs uppercase tracking-[0.18em] text-muted-foreground">
          {event.name} · {formatDate(event.date)} · {event.venue_name}
          {gate.gate_name ? ` · ${gate.gate_name}` : ""}
        </p>
      </header>

      {!usable ? (
        <StaticRedeemState
          label="not accepted"
          title="Gate closed"
          description="Ask the controller to open a new gate."
        />
      ) : eligible.length === 0 ? (
        consumedTicket ? (
          <StaticRedeemState
            label="consumed"
            title="Ticket already consumed"
            description={`Ticket #${consumedTicket.serial_number} has already entered.`}
          />
        ) : (
          <StaticRedeemState
            label="not accepted"
            title="No eligible tickets"
            description={noEligibleDescription}
          />
        )
      ) : (
        <RedeemPanel
          gateShortCode={gate.short_code}
          token={token}
          tickets={eligible.map((ticket) => ({
            id: ticket.id,
            serial_number: ticket.serial_number,
            category_name:
              categoryById.get(ticket.category_id)?.name ?? "Ticket",
            contract_address: ticket.nft_contract_address as string,
            token_id: ticket.nft_token_id as number,
          }))}
        />
      )}
    </div>
  );
}

function StaticRedeemState({
  label,
  title,
  description,
}: {
  label: "consumed" | "not accepted";
  title: string;
  description: string;
}) {
  const accepted = label === "consumed";
  return (
    <section
      className={`mx-auto grid min-h-[320px] max-w-sm content-center justify-items-center gap-4 rounded-md border p-6 text-center ${
        accepted
          ? "border-signal/40 bg-signal/10"
          : "border-destructive/40 bg-destructive/10"
      }`}
    >
      <Badge variant={accepted ? "signal" : "destructive"}>{label}</Badge>
      <h2 className="display text-2xl text-foreground">{title}</h2>
      <p className="text-sm text-muted-foreground">{description}</p>
    </section>
  );
}
