"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatDateShort } from "@/lib/format";
import { shortAddress } from "@/lib/chain/utils";
import type { Ticket, TicketCategory } from "@/types/db";
import { refundTicketAction } from "../../actions";

type StatusFilter = "all" | "sold" | "listed" | "used" | "refund_pending" | "refunded";

export function RefundsPanel({
  tickets,
  categories,
  ownerLabels,
}: {
  tickets: Ticket[];
  categories: TicketCategory[];
  ownerLabels: Record<string, string>;
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const categoryById = new Map(categories.map((category) => [category.id, category]));

  const filtered = tickets.filter((ticket) => {
    if (statusFilter !== "all" && ticket.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const serialMatch = String(ticket.serial_number).includes(q);
      const ownerLabel = ticket.owner_user_id ? (ownerLabels[ticket.owner_user_id] ?? "") : "";
      const ownerMatch = ownerLabel.toLowerCase().includes(q);
      if (!serialMatch && !ownerMatch) return false;
    }
    return true;
  });

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap gap-2">
        <Input
          placeholder="Search by serial # or owner"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-64"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        >
          <option value="all">All statuses</option>
          <option value="sold">sold</option>
          <option value="listed">listed</option>
          <option value="used">used</option>
          <option value="refund_pending">refund_pending</option>
          <option value="refunded">refunded</option>
        </select>
      </div>

      {filtered.length ? (
        filtered.map((ticket) => {
          const category = categoryById.get(ticket.category_id);
          const refundable = ticket.status !== "used" && ticket.status !== "refunded";
          const statusVariant =
            ticket.status === "refunded"
              ? "destructive"
              : ticket.status === "used"
              ? "warning"
              : ticket.status === "refund_pending"
              ? "warning"
              : "success";
          return (
            <Card key={ticket.id} className="rounded-lg">
              <CardContent className="grid gap-4 p-5 lg:grid-cols-[1fr_auto] lg:items-center">
                <div>
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold">Ticket #{ticket.serial_number}</h3>
                    <Badge variant="secondary">{category?.name ?? "Category"}</Badge>
                    <Badge variant={statusVariant}>{ticket.status}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Owner {(ticket.owner_user_id && ownerLabels[ticket.owner_user_id]) || shortAddress(ticket.owner_evm_address) || "unknown"} · Minted {ticket.minted_at ? formatDateShort(ticket.minted_at) : "pending"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {refundable ? (
                    <form action={refundTicketAction} className="flex flex-col gap-2 sm:flex-row">
                      <input type="hidden" name="ticket_id" value={ticket.id} />
                      <Input name="reason" placeholder="Reason" className="w-48" />
                      <Button type="submit" variant="destructive">Refund</Button>
                    </form>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          );
        })
      ) : (
        <Card className="rounded-lg">
          <CardContent className="p-5 text-sm text-muted-foreground">
            {tickets.length ? "No tickets match the current filter." : "No paid tickets to refund yet."}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
