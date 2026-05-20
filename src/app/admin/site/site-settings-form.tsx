"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ImageUploadField } from "@/app/admin/events/image-upload-field";
import type { SiteSettings } from "@/lib/site/settings";
import { updateSiteSettings } from "../actions";

export function SiteSettingsForm({ settings }: { settings: SiteSettings | null }) {
  const [uploading, setUploading] = useState(false);

  return (
    <form action={updateSiteSettings} className="grid gap-5">
      <Card className="glass rounded-lg">
        <CardContent className="grid gap-6 p-5">
          <ImageUploadField
            id="landing-hero-bg"
            name="landing_hero_bg_url"
            label="Homepage background"
            help="Full-width hero background behind the main landing headline."
            initialUrl={settings?.landing_hero_bg_url}
            uploadPath="site/landing/hero"
            onUploadingChange={setUploading}
          />
          <ImageUploadField
            id="landing-audience"
            name="landing_audience_url"
            label="Organizer audience visual"
            help="Image shown inside the organizer callout next to the feature list."
            initialUrl={settings?.landing_audience_url}
            uploadPath="site/landing/audience"
            onUploadingChange={setUploading}
          />
          <ImageUploadField
            id="landing-dashboard"
            name="landing_dashboard_url"
            label="Dashboard visual"
            help="Small dashboard preview layered over the organizer visual."
            initialUrl={settings?.landing_dashboard_url}
            uploadPath="site/landing/dashboard"
            onUploadingChange={setUploading}
          />
        </CardContent>
      </Card>
      <Button type="submit" disabled={uploading} className="w-fit">
        Save landing artwork
      </Button>
    </form>
  );
}
