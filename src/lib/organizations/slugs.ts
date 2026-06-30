const STOREFRONT_SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

export function normalizeStorefrontSlug(
  value: string | undefined,
): string | null {
  const normalized = value?.trim().toLowerCase() ?? "";
  if (!STOREFRONT_SLUG_RE.test(normalized)) return null;
  return normalized;
}
