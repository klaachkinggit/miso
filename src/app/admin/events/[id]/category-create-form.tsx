"use client";

import { useState } from "react";
import { ImagePlus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";
import { createCategory } from "../../actions";

export function CategoryCreateForm({ eventId }: { eventId: string }) {
  const [imageUrl, setImageUrl] = useState("");
  const [uploading, setUploading] = useState(false);

  async function uploadImage(file: File) {
    setUploading(true);
    try {
      const sb = createClient();
      const path = `categories/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9.]/g, "-")}`;
      const { error: uploadError } = await sb.storage.from("event-images").upload(path, file, {
        upsert: false,
        contentType: file.type,
      });
      if (uploadError) throw uploadError;
      const { data } = sb.storage.from("event-images").getPublicUrl(path);
      setImageUrl(data.publicUrl);
    } finally {
      setUploading(false);
    }
  }

  return (
    <Card className="glass h-fit rounded-lg">
      <CardHeader>
        <CardTitle>Add category</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={createCategory} className="grid gap-4">
          <input type="hidden" name="event_id" value={eventId} />
          <input type="hidden" name="image_url" value={imageUrl} />
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
              <Label htmlFor="price">Price</Label>
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
                  <span className="flex items-center gap-2 text-emerald-300">
                    <ImagePlus className="h-4 w-4" /> Tier artwork ready
                  </span>
                ) : (
                  "Used on NFT metadata for this tier. Falls back to the event image if omitted."
                )}
              </div>
            </div>
          </div>
          <label className="flex items-center gap-3 text-sm">
            <input name="resale_enabled" type="checkbox" className="h-4 w-4" defaultChecked />
            Resale enabled
          </label>
          <Button type="submit" disabled={uploading}>
            Create and seed tickets
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
