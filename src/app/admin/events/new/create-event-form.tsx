"use client";

import { useState } from "react";
import { Loader2, Map } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ImageUploadField } from "@/app/admin/events/image-upload-field";
import { DiscoveryFields } from "@/app/admin/events/discovery-fields";
import { uploadPublicEventImage } from "@/lib/supabase/uploads";
import { createEvent } from "../../actions";

export function CreateEventForm({ error, userRole }: { error?: string; userRole?: string }) {
  const [imageUrl, setImageUrl] = useState("");
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [heroUrl, setHeroUrl] = useState("");
  const [ticketVisualUrl, setTicketVisualUrl] = useState("");
  const [marketplaceUrl, setMarketplaceUrl] = useState("");
  const [floorPlanUrl, setFloorPlanUrl] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingFloor, setUploadingFloor] = useState(false);
  const isAdmin = userRole === "admin";

  async function uploadFloorPlan(file: File) {
    setUploadingFloor(true);
    try {
      setFloorPlanUrl(await uploadPublicEventImage(file, "floor-plans"));
    } finally {
      setUploadingFloor(false);
    }
  }

  return (
    <form action={createEvent} className="glass grid gap-5 rounded-lg p-6">
      {error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive-foreground">
          {error}
        </div>
      ) : null}
      <input type="hidden" name="floor_plan_url" value={floorPlanUrl} />
      <div className="grid gap-2">
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" required />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="date">Date</Label>
          <Input id="date" name="date" type="datetime-local" required />
          <p className="text-xs text-muted-foreground">Interpreted as Africa/Casablanca local time.</p>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="capacity">Capacity</Label>
          <Input id="capacity" name="capacity" type="number" min="1" required />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="venue_name">Venue</Label>
          <Input id="venue_name" name="venue_name" required />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="city">City</Label>
          <Input id="city" name="city" required />
        </div>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" name="description" rows={5} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="conditions">Conditions</Label>
        <Textarea id="conditions" name="conditions" rows={3} />
      </div>
      <DiscoveryFields />
      <div className="grid gap-5 rounded-md border border-border/60 bg-background/30 p-4">
        <p className="text-sm font-medium text-foreground/90">Event artwork</p>
        <p className="-mt-3 text-xs text-muted-foreground">
          Upload distinct images for each surface. Any slot left empty falls back to the default image.
        </p>
        <ImageUploadField
          id="event-image"
          name="image_url"
          label="Default / legacy"
          help="Used as a fallback when a specialized variant is missing."
          initialUrl={imageUrl}
          uploadPath="events/drafts/default"
          onUploadingChange={setUploadingImage}
          onUrlChange={setImageUrl}
        />
        <ImageUploadField
          id="event-thumbnail"
          name="thumbnail_url"
          label="Card thumbnail"
          help="Shown on event listings, the home grid, and search results."
          uploadPath="events/drafts/thumbnail"
          onUploadingChange={setUploadingImage}
        />
        <ImageUploadField
          id="event-hero"
          name="hero_url"
          label="Detail hero"
          help="Full-bleed banner on the event page and the homepage featured card."
          uploadPath="events/drafts/hero"
          onUploadingChange={setUploadingImage}
        />
        <ImageUploadField
          id="event-ticket-visual"
          name="ticket_visual_url"
          label="Ticket / NFT visual"
          help="Used on the ticket card in the user's wallet and the on-chain metadata."
          uploadPath="events/drafts/ticket"
          onUploadingChange={setUploadingImage}
        />
        <ImageUploadField
          id="event-marketplace"
          name="marketplace_url"
          label="Resale marketplace"
          help="Appears next to each resale listing on the official exchange."
          uploadPath="events/drafts/marketplace"
          onUploadingChange={setUploadingImage}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="floor_plan">Floor plan / club map</Label>
        <p className="text-xs text-muted-foreground">
          One image per event, attached at event creation. Buyers see it under the ticket
          listings to match each Club Table tier color with its location at the venue.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Input
            id="floor_plan"
            type="file"
            accept="image/*"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void uploadFloorPlan(file);
            }}
          />
          <div className="min-w-40 text-sm text-muted-foreground">
            {uploadingFloor ? (
              <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Uploading</span>
            ) : floorPlanUrl ? (
              <span className="flex items-center gap-2 text-emerald-300"><Map className="h-4 w-4" /> Map ready</span>
            ) : (
              "Optional"
            )}
          </div>
          {floorPlanUrl ? (
            <a
              href={floorPlanUrl}
              target="_blank"
              rel="noreferrer"
              aria-label="Open map preview"
              data-testid="open-map"
              className="inline-flex h-10 items-center gap-2 rounded-md border border-input bg-background/40 px-3 text-sm hover:bg-background/60"
            >
              <Map className="h-4 w-4" /> Open map
            </a>
          ) : null}
        </div>
        {floorPlanUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={floorPlanUrl}
            alt="Floor plan preview"
            className="mt-2 max-h-48 w-auto rounded border border-border/60 object-contain"
          />
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground">
        Sales, resale, and public counter visibility are configured per category.
      </p>
      <Button type="submit" disabled={uploadingImage || uploadingFloor}>
        Create event and mint collection
      </Button>
    </form>
  );
}
