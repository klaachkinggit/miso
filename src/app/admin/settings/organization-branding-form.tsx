"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ImageUploadField } from "@/app/admin/_components/image-upload-field";
import type { OrganizationBranding } from "@/lib/organizations/branding";
import { DEFAULT_ORGANIZATION_ACCENT } from "@/lib/organizations/branding";
import {
  addOrganizationMember,
  deleteOrganization,
  removeOrganizationMember,
  transferOrganization,
  updateOrganizationBranding,
  updateOrganizationRoyalty,
} from "../actions";

function Panel({
  title,
  eyebrow,
  description,
  children,
}: {
  title: string;
  eyebrow: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-md border border-hairline bg-ink-raised">
      <header className="border-b border-hairline px-6 py-5">
        <p className="eyebrow">{eyebrow}</p>
        <h2 className="display mt-2 text-2xl text-foreground">{title}</h2>
        {description ? (
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">{description}</p>
        ) : null}
      </header>
      <div className="p-6">{children}</div>
    </section>
  );
}

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
      <Panel
        eyebrow="Branding"
        title="Storefront identity."
        description="What buyers see on your public storefront — logo, tagline, accent color, and hero image."
      >
        <div className="grid gap-6">
          <div className="grid gap-2">
            <Label htmlFor="tagline">Storefront tagline</Label>
            <Textarea
              id="tagline"
              name="tagline"
              rows={3}
              maxLength={180}
              defaultValue={branding.tagline ?? ""}
              placeholder="A short line buyers see on your storefront."
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
                Used for storefront accents and the official-channel pill.
              </p>
            </div>
          </div>

          <ImageUploadField
            id="organization-logo"
            name="logo_url"
            label="Logo"
            help="Compact mark shown above the storefront name."
            initialUrl={branding.logo_url}
            uploadPath={`organizations/${organizationSlug}/logo`}
            onUploadingChange={setUploading}
          />
          <ImageUploadField
            id="organization-hero"
            name="hero_image_url"
            label="Storefront hero"
            help="Wide image shown behind the storefront header."
            initialUrl={branding.hero_image_url}
            uploadPath={`organizations/${organizationSlug}/hero`}
            onUploadingChange={setUploading}
          />
        </div>
      </Panel>

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
      <Panel
        eyebrow="Resale"
        title="Royalty on secondary sales."
        description="Optional buyer-paid royalty on resale. Seller still receives the listing price."
      >
        <div className="grid gap-5">
          <label className="flex items-start gap-3 rounded-md border border-hairline bg-ink-soft/40 p-4 text-sm">
            <input
              type="checkbox"
              name="resale_royalty_enabled"
              defaultChecked={enabled}
              className="mt-1 h-4 w-4 accent-signal"
            />
            <span>
              <span className="block font-medium text-foreground">Activate royalty</span>
              <span className="text-muted-foreground">
                Add the royalty on top of resale price at checkout.
              </span>
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
              <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                basis points
              </span>
            </div>
            <p className="text-xs text-muted-foreground">500 = 5%. Set 0 or disable for no royalty.</p>
          </div>
        </div>
      </Panel>
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

export function OrganizationTeamPanel({ members }: { members: OrganizationTeamMember[] }) {
  return (
    <Panel
      eyebrow="Team"
      title="Members."
      description="Admins manage the organization. Controllers only scan gates for assigned events."
    >
      <form
        action={addOrganizationMember}
        className="mb-6 grid gap-3 rounded-md border border-hairline bg-ink-soft/40 p-4 md:grid-cols-[1fr_180px_auto] md:items-end"
      >
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
            className="h-11 rounded-md border border-hairline bg-ink-soft/60 px-3 text-sm text-foreground focus:border-signal focus:outline-none focus:ring-2 focus:ring-signal/30"
          >
            <option value="controller">Controller</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <Button type="submit">Add member</Button>
      </form>

      <div className="overflow-hidden rounded-md border border-hairline">
        <table className="w-full text-sm">
          <thead className="bg-ink-soft/40 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Member</th>
              <th className="px-4 py-3 text-left font-medium">Role</th>
              <th className="px-4 py-3 text-right font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {members.map((member) => (
              <tr key={member.id} className="border-t border-hairline">
                <td className="px-4 py-4">
                  <div className="font-medium text-foreground">
                    {member.profiles?.display_name ?? member.profiles?.email ?? "Member"}
                  </div>
                  <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                    {member.profiles?.email}
                  </div>
                </td>
                <td className="px-4 py-4 capitalize text-foreground">{member.role}</td>
                <td className="px-4 py-4 text-right">
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
    </Panel>
  );
}

export function OrganizationOwnershipPanel({
  organizationId,
  organizationName,
}: {
  organizationId: string;
  organizationName: string;
}) {
  return (
    <div className="grid gap-5">
      <Panel
        eyebrow="Ownership"
        title="Transfer organization."
        description="Hand control to another MISO account by making them an admin first, then transferring."
      >
        <form
          action={transferOrganization}
          className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end"
        >
          <div className="grid gap-2">
            <Label htmlFor="transfer-email">Transfer to email</Label>
            <Input id="transfer-email" name="email" type="email" required placeholder="owner@example.com" />
          </div>
          <Button type="submit">Transfer organization</Button>
        </form>
      </Panel>

      <section className="rounded-md border border-destructive/40 bg-destructive/[0.04]">
        <header className="border-b border-destructive/30 px-6 py-5">
          <p className="font-mono text-[11px] font-medium uppercase tracking-[0.22em] text-destructive">
            Danger zone
          </p>
          <h2 className="display mt-2 text-2xl text-destructive">Delete organization.</h2>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            Delete only empty organizations. Stripe accounts, events, purchases, customers, or listings block deletion.
          </p>
        </header>
        <form
          action={deleteOrganization}
          className="grid gap-3 p-6 md:grid-cols-[1fr_auto] md:items-end"
        >
          <input type="hidden" name="organization_id" value={organizationId} />
          <div className="grid gap-2">
            <Label htmlFor="delete-confirm-name">Confirm organization name</Label>
            <Input
              id="delete-confirm-name"
              name="confirm_name"
              required
              placeholder={organizationName}
              autoComplete="off"
            />
          </div>
          <Button type="submit" variant="destructive">
            Delete organization
          </Button>
        </form>
      </section>
    </div>
  );
}
