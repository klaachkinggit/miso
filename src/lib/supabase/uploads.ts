"use client";

import { createClient } from "@/lib/supabase/client";

const EVENT_IMAGE_BUCKET = "event-images";

function safeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9.]/g, "-");
}

export async function uploadPublicEventImage(file: File, prefix?: string): Promise<string> {
  const sb = createClient();
  const cleanPrefix = prefix?.replace(/^\/+|\/+$/g, "");
  const path = [cleanPrefix, `${crypto.randomUUID()}-${safeFileName(file.name)}`]
    .filter(Boolean)
    .join("/");
  const { error } = await sb.storage.from(EVENT_IMAGE_BUCKET).upload(path, file, {
    upsert: false,
    contentType: file.type,
  });
  if (error) throw error;
  const { data } = sb.storage.from(EVENT_IMAGE_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
