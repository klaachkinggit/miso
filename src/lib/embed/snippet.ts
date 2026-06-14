const TRAILING_SLASHES = /\/+$/;

/** Build the copy-paste install line for the embeddable checkout widget. */
export function buildEmbedSnippet(origin: string, categoryId: string): string {
  const base = origin.replace(TRAILING_SLASHES, "");
  return `<script src="${base}/embed.js" data-miso-category="${categoryId}" async></script>`;
}
