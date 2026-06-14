import "server-only";

import { headers } from "next/headers";

/** True when the current request targets the chrome-less embed widget route. */
export async function isEmbedRequest(): Promise<boolean> {
  const pathname = (await headers()).get("x-pathname") ?? "";
  return pathname === "/embed" || pathname.startsWith("/embed/");
}
