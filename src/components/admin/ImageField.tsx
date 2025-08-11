"use client";

import { useRef, useState } from "react";

type Props = {
  name: string; // name of text input bound to product.image
};

export default function ImageField({ name }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleChooseFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const res = await fetch("/api/images/direct-upload", { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data?.uploadURL) throw new Error(data?.error || "Failed to get upload URL");

      const form = new FormData();
      form.append("file", file);
      const up = await fetch(data.uploadURL, { method: "POST", body: form });
      const result = await up.json();
      if (!up.ok || !result?.success) throw new Error("Upload failed");

      // Cloudflare returns an id like <account_hash>/<image_id>
      const id: string | undefined = result?.result?.id || result?.result?.uid || result?.id;
      if (!id) throw new Error("Missing image id");

      // Write to hidden text input so server action persists it
      const el = inputRef.current;
      if (el) {
        el.value = id;
        el.dispatchEvent(new Event("input", { bubbles: true }));
      }
    } catch (err: unknown) {
      const message = typeof err === "object" && err && "message" in err ? String((err as { message?: string }).message) : "Upload error";
      setError(message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex items-center gap-2 w-full">
      <input ref={inputRef} name={name} placeholder="Image ID or absolute URL" className="border rounded px-2 py-1 flex-1" />
      <input type="file" accept="image/*" onChange={handleChooseFile} disabled={uploading} />
      {uploading && <span className="text-xs text-gray-500">Uploading…</span>}
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
