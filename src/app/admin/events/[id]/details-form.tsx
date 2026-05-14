import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { casablancaInputValue, shortAddress } from "@/lib/format";
import type { EventRow } from "@/types/db";
import { cancelEvent, publishEvent, unpublishEvent, updateEvent } from "../../actions";

export function DetailsForm({ event }: { event: EventRow }) {
  return (
    <div className="grid gap-5">
      <Card className="glass rounded-lg">
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-3">
            <span>Event details</span>
            <Badge variant={event.status === "published" ? "success" : "secondary"}>{event.status}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form action={updateEvent} className="grid gap-5">
            <input type="hidden" name="event_id" value={event.id} />
            <div className="grid gap-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" defaultValue={event.name} required />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="date">Date</Label>
                <Input id="date" name="date" type="datetime-local" defaultValue={casablancaInputValue(event.date)} required />
                <p className="text-xs text-muted-foreground">Interpreted as Africa/Casablanca local time.</p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="capacity">Capacity</Label>
                <Input id="capacity" name="capacity" type="number" min="1" defaultValue={event.capacity} required />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="venue_name">Venue</Label>
                <Input id="venue_name" name="venue_name" defaultValue={event.venue_name} required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="city">City</Label>
                <Input id="city" name="city" defaultValue={event.city} required />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="image_url">Image URL</Label>
              <Input id="image_url" name="image_url" defaultValue={event.image_url ?? ""} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" name="description" rows={5} defaultValue={event.description ?? ""} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="conditions">Conditions</Label>
              <Textarea id="conditions" name="conditions" rows={3} defaultValue={event.conditions ?? ""} />
            </div>
            <div className="grid gap-3 rounded-md border border-border/70 p-4 text-sm">
              <label className="flex items-center gap-3">
                <input name="sales_enabled" type="checkbox" className="h-4 w-4" defaultChecked={event.sales_enabled} />
                Sales enabled
              </label>
              <label className="flex items-center gap-3">
                <input name="resale_enabled" type="checkbox" className="h-4 w-4" defaultChecked={event.resale_enabled} />
                Resale enabled
              </label>
              <label className="flex items-center gap-3">
                <input
                  name="public_sales_counter_enabled"
                  type="checkbox"
                  className="h-4 w-4"
                  defaultChecked={event.public_sales_counter_enabled}
                />
                Public sales counter
              </label>
            </div>
            <Button type="submit">Save changes</Button>
          </form>
        </CardContent>
      </Card>

      <Card className="glass rounded-lg">
        <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="font-semibold">MisoTicket contract</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {event.nft_contract_address ? (
                <a
                  href={`https://sepolia.basescan.org/address/${event.nft_contract_address}`}
                  target="_blank"
                  rel="noreferrer"
                  className="underline"
                >
                  {shortAddress(event.nft_contract_address, 6)}
                </a>
              ) : (
                "Deployed when the event is published."
              )}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {!event.nft_contract_address && event.status !== "draft" ? (
              <form action={`/api/admin/events/${event.id}/retry-deploy`} method="post">
                <Button type="submit" variant="outline">Retry deploy</Button>
              </form>
            ) : null}
            {event.status === "published" ? (
              <form action={unpublishEvent}>
                <input type="hidden" name="event_id" value={event.id} />
                <Button type="submit" variant="outline">Unpublish</Button>
              </form>
            ) : event.status === "draft" ? (
              <form action={publishEvent}>
                <input type="hidden" name="event_id" value={event.id} />
                <Button type="submit">Publish</Button>
              </form>
            ) : null}
            {event.status !== "canceled" ? (
              <form action={cancelEvent}>
                <input type="hidden" name="event_id" value={event.id} />
                <Button type="submit" variant="destructive">Cancel event</Button>
              </form>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
