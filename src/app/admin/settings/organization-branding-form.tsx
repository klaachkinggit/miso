"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ImageUploadField } from "@/app/admin/events/image-upload-field";
import type { OrganizationBranding } from "@/lib/organizations/branding";
import { DEFAULT_ORGANIZATION_ACCENT } from "@/lib/organizations/branding";
import {
  updateOrganizationBranding,
  updateOrganizationRoyalty,
} from "../actions";

export function OrganizationBrandingForm({
  branding,
  organizationSlug,
}: {
  branding: OrganizationBranding;
  organizationSlug: string;
}) {
  const [uploading, setUploading] = useState(false);
  const accent = branding.accent_color ?? DEFAULT_ORGANIZATION_ACCENT;

  return (
    <form action={updateOrganizationBranding} className="grid gap-5">
      <Card className="glass rounded-lg">
        <CardContent className="grid gap-6 p-5">
          <div className="grid gap-2">
            <Label htmlFor="tagline">Storefront tagline</Label>
            <Textarea
              id="tagline"
              name="tagline"
              rows={3}
              maxLength={180}
              defaultValue={branding.tagline ?? ""}
              placeholder="A short line buyers see on your billeterie."
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="accent_color">Accent color</Label>
            <div className="flex flex-wrap items-center gap-3">
              <Input
                id="accent_color"
                name="accent_color"
                type="color"
                defaultValue={accent}
                className="h-11 w-20 p-1"
              />
              <p className="text-sm text-muted-foreground">
                Used for public storefront pills and visual accents.
              </p>
            </div>
          </div>

          <ImageUploadField
            id="organization-logo"
            name="logo_url"
            label="Logo"
            help="Compact mark shown above the public Organization name."
            initialUrl={branding.logo_url}
            uploadPath={`organizations/${organizationSlug}/logo`}
            onUploadingChange={setUploading}
          />
          <ImageUploadField
            id="organization-hero"
            name="hero_image_url"
            label="Storefront hero"
            help="Wide image shown behind the public Organization storefront header."
            initialUrl={branding.hero_image_url}
            uploadPath={`organizations/${organizationSlug}/hero`}
            onUploadingChange={setUploading}
          />
        </CardContent>
      </Card>

      <Button type="submit" disabled={uploading} className="w-fit">
        Save branding
      </Button>
    </form>
  );
}

export function OrganizationRoyaltyForm({
  enabled,
  bps,
}: {
  enabled: boolean;
  bps: number;
}) {
  return (
    <form action={updateOrganizationRoyalty} className="grid gap-5">
      <Card className="glass rounded-lg">
        <CardContent className="grid gap-5 p-5">
          <div>
            <h2 className="text-lg font-semibold">Resale royalty</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Optional buyer-paid royalty on secondary marketplace sales. Seller still receives the listing price.
            </p>
          </div>
          <label className="flex items-start gap-3 rounded-md border border-border/70 bg-background/30 p-4 text-sm">
            <input
              type="checkbox"
              name="resale_royalty_enabled"
              defaultChecked={enabled}
              className="mt-1 h-4 w-4"
            />
            <span>
              <span className="block font-medium text-foreground">Activate royalty</span>
              <span className="text-muted-foreground">Add the royalty on top of resale price at checkout.</span>
            </span>
          </label>
          <div className="grid gap-2 sm:max-w-xs">
            <Label htmlFor="resale_royalty_bps">Royalty rate</Label>
            <div className="flex items-center gap-2">
              <Input
                id="resale_royalty_bps"
                name="resale_royalty_bps"
                type="number"
                min="0"
                max="10000"
                step="25"
                defaultValue={bps}
              />
              <span className="text-sm text-muted-foreground">basis points</span>
            </div>
            <p className="text-xs text-muted-foreground">500 = 5%. Set 0 or disable to charge no royalty.</p>
          </div>
        </CardContent>
      </Card>
      <Button type="submit" className="w-fit">
        Save royalty settings
      </Button>
    </form>
  );
}
