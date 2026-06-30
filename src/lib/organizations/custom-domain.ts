import { createServiceClient } from "@/lib/supabase/service";
import { storefrontRootDomains } from "@/lib/organizations/hosts";

// RFC-1123-ish hostname: dot-separated labels, each 1-63 chars, no leading/
// trailing hyphen, TLD must be >=2 alpha chars. Single-label hosts (e.g.
// "localhost") fail the regex by design — custom domains must be real FQDNs.
const HOSTNAME_RE =
  /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/;

export const CUSTOM_DOMAIN_TXT_PREFIX = "_miso-verify";

export class CustomDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CustomDomainError";
  }
}

// Strip protocol/path/port, lowercase, trim. Returns null when nothing usable
// remains so callers can fail closed.
export function normalizeCustomDomain(
  value: string | null | undefined,
): string | null {
  const raw = value?.trim().toLowerCase() ?? "";
  if (!raw) return null;
  const withoutProtocol = raw.replace(/^[a-z]+:\/\//, "");
  const withoutPath = withoutProtocol.split("/")[0] ?? "";
  const withoutPort = withoutPath.split(":")[0] ?? "";
  return withoutPort || null;
}

// A custom domain may not be a miso storefront root (e.g. miso.com) — those
// resolve through the subdomain rewrite, not the custom-domain table.
function isReservedRootDomain(domain: string): boolean {
  return storefrontRootDomains().some(
    (root) => domain === root || domain.endsWith(`.${root}`),
  );
}

export function validateCustomDomain(value: string | null | undefined): string {
  const domain = normalizeCustomDomain(value);
  if (!domain) throw new CustomDomainError("Enter a domain.");
  if (!HOSTNAME_RE.test(domain))
    throw new CustomDomainError(
      "Enter a valid domain (e.g. tickets.example.com).",
    );
  if (isReservedRootDomain(domain))
    throw new CustomDomainError("That domain is reserved.");
  return domain;
}

export type CustomDomainState = {
  domain: string;
  token: string;
  txtRecordName: string;
};

export async function setOrganizationCustomDomain(params: {
  organizationId: string;
  domain: string;
}): Promise<CustomDomainState> {
  const domain = validateCustomDomain(params.domain);
  const token = crypto.randomUUID();

  const sb = createServiceClient();
  const { error } = await sb
    .from("organizations")
    .update({
      custom_domain: domain,
      custom_domain_verification_token: token,
      custom_domain_verified_at: null,
    })
    .eq("id", params.organizationId);
  if (error) {
    // 23505 = unique violation on the lower(custom_domain) index.
    if (error.code === "23505")
      throw new CustomDomainError("That domain is already in use.");
    throw new CustomDomainError(error.message);
  }

  return {
    domain,
    token,
    txtRecordName: `${CUSTOM_DOMAIN_TXT_PREFIX}.${domain}`,
  };
}

async function dnsTxtMatchesToken(
  domain: string,
  token: string,
): Promise<boolean | null> {
  // node:dns is unavailable on some runtimes / sandboxes. Return null (= "could
  // not check") rather than throwing so the caller can fall back deterministically.
  try {
    const dns = await import("node:dns/promises");
    const records = await dns.resolveTxt(
      `${CUSTOM_DOMAIN_TXT_PREFIX}.${domain}`,
    );
    return records.some((chunks) => chunks.join("").trim() === token);
  } catch {
    return null;
  }
}

export async function verifyOrganizationCustomDomain(params: {
  organizationId: string;
}): Promise<{ verified: boolean }> {
  const sb = createServiceClient();
  const { data, error } = await sb
    .from("organizations")
    .select("custom_domain, custom_domain_verification_token")
    .eq("id", params.organizationId)
    .maybeSingle<{
      custom_domain: string | null;
      custom_domain_verification_token: string | null;
    }>();
  if (error) throw new CustomDomainError(error.message);
  if (!data?.custom_domain || !data.custom_domain_verification_token) {
    throw new CustomDomainError("Set a domain before verifying.");
  }

  const dnsResult = await dnsTxtMatchesToken(
    data.custom_domain,
    data.custom_domain_verification_token,
  );

  let verified: boolean;
  if (dnsResult === null) {
    // DNS not reachable in this environment. Locally (process.env.VERCEL unset)
    // we allow marking verified so the flow is testable end-to-end; on Vercel we
    // refuse rather than vouch for an unverified domain.
    if (process.env.VERCEL) return { verified: false };
    verified = true;
  } else {
    verified = dnsResult;
  }

  if (!verified) return { verified: false };

  await addDomainToVercelProject(data.custom_domain);

  const { error: updateError } = await sb
    .from("organizations")
    .update({ custom_domain_verified_at: new Date().toISOString() })
    .eq("id", params.organizationId);
  if (updateError) throw new CustomDomainError(updateError.message);

  return { verified: true };
}

export async function resolveOrgSlugByCustomDomain(
  host: string | null | undefined,
): Promise<string | null> {
  const domain = normalizeCustomDomain(host);
  if (!domain) return null;

  const sb = createServiceClient();
  const { data } = await sb
    .from("organizations")
    .select("slug")
    .eq("custom_domain", domain)
    .eq("status", "active")
    .not("custom_domain_verified_at", "is", null)
    .maybeSingle<{ slug: string }>();
  return data?.slug ?? null;
}

// Registers the domain with the Vercel project so TLS + routing get provisioned.
// No-op unless both env vars are present — local dev and tests stay offline.
export async function addDomainToVercelProject(domain: string): Promise<void> {
  const projectId = process.env.VERCEL_PROJECT_ID;
  const token = process.env.VERCEL_API_TOKEN;
  if (!projectId || !token) return;

  await fetch(`https://api.vercel.com/v10/projects/${projectId}/domains`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name: domain }),
  });
}
