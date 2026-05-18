import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatDateShort } from "@/lib/format";
import { shortAddress } from "@/lib/chain/utils";
import type { Ticket, TicketCategory } from "@/types/db";
import { refundTicketAction } from "../../actions";

export function RefundsPanel({
  tickets,
  categories,
}: {
  tickets: Ticket[];
  categories: TicketCategory[];
}) {
  const categoryById = new Map(categories.map((category) => [category.id, category]));

  return (
    <div className="grid gap-4">
      {tickets.length ? (
        tickets.map((ticket) => {
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
            <Card key={ticket.id} className="glass rounded-lg">
              <CardContent className="grid gap-4 p-5 lg:grid-cols-[1fr_auto] lg:items-center">
                <div>
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold">Ticket #{ticket.serial_number}</h3>
                    <Badge variant="secondary">{category?.name ?? "Category"}</Badge>
                    <Badge variant={statusVariant}>{ticket.status}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Owner {shortAddress(ticket.owner_evm_address)} · Minted {ticket.minted_at ? formatDateShort(ticket.minted_at) : "pending"}
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
        <Card className="glass rounded-lg">
          <CardContent className="p-5 text-sm text-muted-foreground">No paid tickets to refund yet.</CardContent>
        </Card>
      )}
    </div>
  );
}
