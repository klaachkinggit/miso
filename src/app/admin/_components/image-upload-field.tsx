"use client";

import { useState } from "react";
import { ImagePlus, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { uploadPublicEventImage } from "@/lib/supabase/uploads";

interface ImageUploadFieldProps {
  id: string;
  name: string;
  label: string;
  help?: string;
  initialUrl?: string | null;
  uploadPath: string;
  onUploadingChange?: (uploading: boolean) => void;
  onUrlChange?: (url: string) => void;
}

export function ImageUploadField({
  id,
  name,
  label,
  help,
  initialUrl,
  uploadPath,
  onUploadingChange,
  onUrlChange,
}: ImageUploadFieldProps) {
  const [url, setUrl] = useState(initialUrl ?? "");
  const [uploading, setUploading] = useState(false);

  async function upload(file: File) {
    setUploading(true);
    onUploadingChange?.(true);
    try {
      const uploadedUrl = await uploadPublicEventImage(file, uploadPath);
      setUrl(uploadedUrl);
      onUrlChange?.(uploadedUrl);
    } finally {
      setUploading(false);
      onUploadingChange?.(false);
    }
  }

  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      {help ? <p className="text-xs text-muted-foreground">{help}</p> : null}
      <input type="hidden" name={name} value={url} />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input
          id={id}
          type="file"
          accept="image/*"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void upload(file);
          }}
        />
        <div className="min-w-40 text-sm text-muted-foreground">
          {uploading ? (
            <span className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Uploading
            </span>
          ) : url ? (
            <span className="flex items-center gap-2 text-signal">
              <ImagePlus className="h-4 w-4" /> Image ready
            </span>
          ) : (
            "Optional"
          )}
        </div>
      </div>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={`${label} preview`}
          className="mt-2 max-h-40 w-auto rounded border border-border/60 object-contain"
        />
      ) : null}
    </div>
  );
}
