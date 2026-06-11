"use client";

import { useState } from "react";
import { ImagePlus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { uploadPublicEventImage } from "@/lib/supabase/uploads";
import { createCategory } from "../../actions";

type Kind = "standard" | "club_table";

export function CategoryCreateForm({ eventId }: { eventId: string }) {
  const [imageUrl, setImageUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [kind, setKind] = useState<Kind>("standard");
  const [color, setColor] = useState("#D4AF37");
  const [extraGuests, setExtraGuests] = useState(false);

  async function uploadImage(file: File) {
    setUploading(true);
    try {
      setImageUrl(await uploadPublicEventImage(file, "categories"));
    } finally {
      setUploading(false);
    }
  }

  const isClub = kind === "club_table";

  return (
    <Card className="h-fit rounded-lg">
      <CardHeader>
        <p className="eyebrow">Inventory</p>
        <CardTitle>Add category.</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={createCategory} className="grid gap-4">
          <input type="hidden" name="event_id" value={eventId} />
          <input type="hidden" name="image_url" value={imageUrl} />

          <div className="grid gap-2">
            <Label htmlFor="kind">Category type</Label>
            <select
              id="kind"
              name="kind"
              value={kind}
              onChange={(e) => setKind(e.target.value as Kind)}
              className="h-10 rounded-md border border-input bg-background/40 px-3 text-sm"
            >
              <option value="standard">Standard ticket</option>
              <option value="club_table">Club table</option>
            </select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="category-name">Name</Label>
            <Input id="category-name" name="name" required />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="category-description">Description</Label>
            <Textarea id="category-description" name="description" rows={3} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="price">{isClub ? "Table price (base)" : "Price"}</Label>
              <Input id="price" name="price" type="number" step="0.01" min="0" required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="currency">Currency</Label>
              <input
                id="currency"
                name="currency"
                value="EUR"
                readOnly
                className="h-10 rounded-md border border-input bg-background/40 px-3 text-sm text-muted-foreground"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="supply">Supply</Label>
              <Input id="supply" name="supply" type="number" min="1" required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="max_resale_price">Max resale</Label>
              <Input id="max_resale_price" name="max_resale_price" type="number" step="0.01" min="0" />
            </div>
          </div>

          {isClub ? (
            <div className="grid gap-3 rounded-md border border-hairline bg-ink-soft p-3">
              <p className="eyebrow-signal">Club table</p>
              <p className="text-xs text-muted-foreground">
                The table price above doubles as the minimum spending for the table.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="online_advance">Online advance</Label>
                  <Input
                    id="online_advance"
                    name="online_advance"
                    type="number"
                    step="0.01"
                    min="0"
                    required={isClub}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="base_capacity">Base guests included</Label>
                  <Input
                    id="base_capacity"
                    name="base_capacity"
                    type="number"
                    min="1"
                    defaultValue={4}
                    required={isClub}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="color_hex">Color vignette</Label>
                  <div className="flex items-center gap-2">
                    <input
                      id="color_hex"
                      name="color_hex"
                      type="color"
                      value={color}
                      onChange={(e) => setColor(e.target.value)}
                      className="h-10 w-12 cursor-pointer rounded border border-input bg-transparent"
                    />
                    <span className="font-mono text-xs text-muted-foreground">{color}</span>
                  </div>
                </div>
              </div>
              <label className="flex items-center gap-3 text-sm">
                <input
                  name="extra_guests_enabled"
                  type="checkbox"
                  className="h-4 w-4"
                  checked={extraGuests}
                  onChange={(e) => setExtraGuests(e.target.checked)}
                />
                Allow extra guests beyond base capacity
              </label>
              {extraGuests ? (
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-2">
                    <Label htmlFor="price_per_extra_guest">Price per extra guest</Label>
                    <Input
                      id="price_per_extra_guest"
                      name="price_per_extra_guest"
                      type="number"
                      step="0.01"
                      min="0"
                      required={extraGuests}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="max_extra_guests">Max extra guests</Label>
                    <Input
                      id="max_extra_guests"
                      name="max_extra_guests"
                      type="number"
                      min="1"
                      required={extraGuests}
                    />
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="grid gap-2">
            <Label htmlFor="benefits">Benefits</Label>
            <Textarea id="benefits" name="benefits" rows={3} />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="category-image">Category artwork</Label>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Input
                id="category-image"
                type="file"
                accept="image/*"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void uploadImage(file);
                }}
              />
              <div className="min-w-40 text-xs text-muted-foreground">
                {uploading ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> Uploading
                  </span>
                ) : imageUrl ? (
                  <span className="flex items-center gap-2 text-signal">
                    <ImagePlus className="h-4 w-4" /> Tier artwork ready
                  </span>
                ) : (
                  "Used on NFT metadata for this tier. Falls back to the event image if omitted."
                )}
              </div>
            </div>
          </div>

          <div className="grid gap-2 rounded-md border border-border/70 p-3 text-sm">
            <label className="flex items-center gap-3">
              <input name="sales_enabled" type="checkbox" className="h-4 w-4" defaultChecked />
              Sales enabled
            </label>
            <label className="flex items-center gap-3">
              <input name="resale_enabled" type="checkbox" className="h-4 w-4" defaultChecked />
              Resale enabled
            </label>
            <label className="flex items-center gap-3">
              <input
                name="public_sales_counter_enabled"
                type="checkbox"
                className="h-4 w-4"
                defaultChecked
              />
              Public sales counter (show exact remaining)
            </label>
          </div>

          <Button type="submit" disabled={uploading}>
            Create and seed tickets
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
