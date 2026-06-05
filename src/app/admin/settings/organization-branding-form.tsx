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
  addOrganizationMember,
  removeOrganizationMember,
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

export type OrganizationTeamMember = {
  id: string;
  role: "admin" | "controller";
  user_id: string;
  profiles: {
    email: string | null;
    display_name: string | null;
  } | null;
};

export function OrganizationTeamPanel({
  members,
}: {
  members: OrganizationTeamMember[];
}) {
  return (
    <Card className="glass rounded-lg">
      <CardContent className="grid gap-5 p-5">
        <div>
          <h2 className="text-lg font-semibold">Team</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Admins manage the Organization. Controllers only scan gates for assigned events.
          </p>
        </div>

        <form action={addOrganizationMember} className="grid gap-3 rounded-md border border-border/70 p-4 md:grid-cols-[1fr_180px_auto] md:items-end">
          <div className="grid gap-2">
            <Label htmlFor="member-email">Email</Label>
            <Input id="member-email" name="email" type="email" required placeholder="teammate@example.com" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="member-role">Role</Label>
            <select
              id="member-role"
              name="role"
              defaultValue="controller"
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="controller">Controller</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <Button type="submit">Add member</Button>
        </form>

        <div className="overflow-hidden rounded-md border border-border/70">
          <table className="w-full text-sm">
            <thead className="bg-secondary/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Member</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr key={member.id} className="border-t border-border/70">
                  <td className="px-4 py-3">
                    <div className="font-medium">{member.profiles?.display_name ?? member.profiles?.email ?? "Member"}</div>
                    <div className="text-xs text-muted-foreground">{member.profiles?.email}</div>
                  </td>
                  <td className="px-4 py-3 capitalize">{member.role}</td>
                  <td className="px-4 py-3 text-right">
                    <form action={removeOrganizationMember}>
                      <input type="hidden" name="membership_id" value={member.id} />
                      <Button type="submit" variant="outline" size="sm">
                        Remove
                      </Button>
                    </form>
                  </td>
                </tr>
              ))}
              {members.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-sm text-muted-foreground" colSpan={3}>
                    No team members yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
