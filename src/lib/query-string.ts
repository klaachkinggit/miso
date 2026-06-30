export type QueryPatch = Record<
  string,
  string | null | undefined | readonly string[]
>;

function isReadonlyStringArray(
  value: QueryPatch[string],
): value is readonly string[] {
  return Array.isArray(value);
}

export function patchedQueryHref(
  params: Pick<URLSearchParams, "toString"> | null | undefined,
  next: QueryPatch,
  basePath = "",
) {
  const merged = new URLSearchParams(params?.toString());
  for (const [key, value] of Object.entries(next)) {
    const text = isReadonlyStringArray(value) ? value.join(",") : value;
    if (text === null || text === undefined || text === "") merged.delete(key);
    else merged.set(key, text);
  }
  const query = merged.toString();
  return `${basePath}${query ? `?${query}` : ""}`;
}
