"use client";

import { useState } from "react";
import { ImagePlus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";
import { createEvent } from "../../actions";

export function CreateEventForm({ error }: { error?: string }) {
  const [imageUrl, setImageUrl] = useState("");
  const [uploading, setUploading] = useState(false);

  async function uploadImage(file: File) {
    setUploading(true);
    try {
      const sb = createClient();
      const path = `${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9.]/g, "-")}`;
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
    <form action={createEvent} className="glass grid gap-5 rounded-lg p-6">
      {error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive-foreground">
          {error}
        </div>
      ) : null}
      <input type="hidden" name="image_url" value={imageUrl} />
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
      <div className="grid gap-2">
        <Label htmlFor="image">Image</Label>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Input
            id="image"
            type="file"
            accept="image/*"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void uploadImage(file);
            }}
          />
          <div className="min-w-40 text-sm text-muted-foreground">
            {uploading ? (
              <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Uploading</span>
            ) : imageUrl ? (
              <span className="flex items-center gap-2 text-emerald-300"><ImagePlus className="h-4 w-4" /> Uploaded</span>
            ) : (
              "Optional"
            )}
          </div>
        </div>
      </div>
      <div className="grid gap-3 rounded-md border border-border/70 p-4 text-sm">
        <label className="flex items-center gap-3">
          <input name="sales_enabled" type="checkbox" className="h-4 w-4" />
          Sales enabled
        </label>
        <label className="flex items-center gap-3">
          <input name="resale_enabled" type="checkbox" className="h-4 w-4" defaultChecked />
          Resale enabled
        </label>
        <label className="flex items-center gap-3">
          <input name="public_sales_counter_enabled" type="checkbox" className="h-4 w-4" />
          Public sales counter
        </label>
      </div>
      <Button type="submit" disabled={uploading}>Create event and mint collection</Button>
    </form>
  );
}
