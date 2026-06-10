"use client";

import { useState } from "react";
import { Loader2, Map } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { casablancaInputValue } from "@/lib/format";
import { shortAddress } from "@/lib/chain/utils";
import { uploadPublicEventImage } from "@/lib/supabase/uploads";
import { ImageUploadField } from "@/app/admin/events/image-upload-field";
import { DiscoveryFields } from "@/app/admin/events/discovery-fields";
import type { EventRow } from "@/types/db";
import { cancelEvent, publishEvent, unpublishEvent, updateEvent } from "../../actions";

export function DetailsForm({ event }: { event: EventRow }) {
  const [floorPlanUrl, setFloorPlanUrl] = useState(event.floor_plan_url ?? "");
  const [uploadingFloor, setUploadingFloor] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  async function uploadFloorPlan(file: File) {
    setUploadingFloor(true);
    try {
      setFloorPlanUrl(await uploadPublicEventImage(file, `events/${event.id}/floor-plans`));
    } finally {
      setUploadingFloor(false);
    }
  }

  return (
    <div className="grid gap-5">
      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-3">
            <span>Event details</span>
            <Badge variant={event.status === "published" ? "success" : "secondary"}>{event.status}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form action={updateEvent} className="grid gap-5">
            <input type="hidden" name="event_id" value={event.id} />
            <input type="hidden" name="floor_plan_url" value={floorPlanUrl} />
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
            <DiscoveryFields event={event} />
            <div className="grid gap-5 rounded-md border border-border/60 bg-background/30 p-4">
              <p className="text-sm font-medium text-foreground/90">Event artwork</p>
              <p className="-mt-3 text-xs text-muted-foreground">
                Upload distinct images for each surface. Any slot left empty falls back to the legacy event image.
              </p>
              <ImageUploadField
                id="event-image"
                name="image_url"
                label="Default / legacy"
                help="Used as a fallback when a specialized variant is missing."
                initialUrl={event.image_url}
                uploadPath={`events/${event.id}`}
                onUploadingChange={setUploadingImage}
              />
              <ImageUploadField
                id="event-thumbnail"
                name="thumbnail_url"
                label="Card thumbnail"
                help="Shown on event listings, the home grid, and search results."
                initialUrl={event.thumbnail_url}
                uploadPath={`events/${event.id}/thumbnail`}
                onUploadingChange={setUploadingImage}
              />
              <ImageUploadField
                id="event-hero"
                name="hero_url"
                label="Detail hero"
                help="Full-bleed banner on the event page and the homepage featured card."
                initialUrl={event.hero_url}
                uploadPath={`events/${event.id}/hero`}
                onUploadingChange={setUploadingImage}
              />
              <ImageUploadField
                id="event-ticket-visual"
                name="ticket_visual_url"
                label="Ticket / NFT visual"
                help="Used on the ticket card in the user's wallet and the on-chain metadata."
                initialUrl={event.ticket_visual_url}
                uploadPath={`events/${event.id}/ticket`}
                onUploadingChange={setUploadingImage}
              />
              <ImageUploadField
                id="event-marketplace"
                name="marketplace_url"
                label="Resale marketplace"
                help="Appears next to each resale listing on the official exchange."
                initialUrl={event.marketplace_url}
                uploadPath={`events/${event.id}/marketplace`}
                onUploadingChange={setUploadingImage}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" name="description" rows={5} defaultValue={event.description ?? ""} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="conditions">Conditions</Label>
              <Textarea id="conditions" name="conditions" rows={3} defaultValue={event.conditions ?? ""} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="floor-plan">Floor plan / club map</Label>
              <p className="text-xs text-muted-foreground">
                Shown to buyers below the ticket listings so they can cross-reference the
                color vignette of each Club Table tier with its location at the venue.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <Input
                  id="floor-plan"
                  type="file"
                  accept="image/*"
                  onChange={(uploadEvent) => {
                    const file = uploadEvent.target.files?.[0];
                    if (file) void uploadFloorPlan(file);
                  }}
                />
                <div className="min-w-40 text-sm text-muted-foreground">
                  {uploadingFloor ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" /> Uploading
                    </span>
                  ) : floorPlanUrl ? (
                    <span className="flex items-center gap-2 text-emerald-300">
                      <Map className="h-4 w-4" /> Map ready
                    </span>
                  ) : (
                    "Optional"
                  )}
                </div>
              </div>
              {floorPlanUrl ? (
                <>
                  <a
                    href={floorPlanUrl}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="Open map preview"
                    data-testid="open-map"
                    className="mt-2 inline-flex h-10 w-fit items-center gap-2 rounded-md border border-input bg-background/40 px-3 text-sm hover:bg-background/60"
                  >
                    <Map className="h-4 w-4" /> Open map
                  </a>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={floorPlanUrl}
                    alt="Floor plan preview"
                    className="mt-2 max-h-48 w-auto rounded border border-border/60 object-contain"
                  />
                </>
              ) : null}
            </div>
            <p className="text-xs text-muted-foreground">
              Sales, resale, and the public counter are configured per category in the panel
              below.
            </p>
            <Button type="submit" disabled={uploadingImage || uploadingFloor}>Save changes</Button>
          </form>
        </CardContent>
      </Card>

      <Card className="rounded-lg">
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
