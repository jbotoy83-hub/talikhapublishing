"use client";

import Image from "next/image";
import { useEffect, useRef, useState, useTransition } from "react";
import { uploadEditorialImage } from "@/app/admin/actions";

type Props = {
  entityType: "author" | "journal" | "issue";
  entityId: string;
  placementKey: "author_portrait" | "journal_hero" | "issue_cover";
  currentUrl?: string | null;
  label: string;
};

export function EditorialImageUploader({ entityType, entityId, placementKey, currentUrl, label }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const objectUrlRef = useRef<string | null>(null);
  const [preview, setPreview] = useState(currentUrl || "");
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  useEffect(() => () => {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
  }, []);

  function choose(file: File | null) {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 12 * 1024 * 1024) { setMessage("Use a JPG, PNG, or WebP image up to 12 MB."); return; }
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = URL.createObjectURL(file);
    setPreview(objectUrlRef.current); setMessage("");
    startTransition(async () => {
      const data = new FormData();
      data.set("entityType", entityType); data.set("entityId", entityId); data.set("placementKey", placementKey);
      data.set("image", file); data.set("altText", label);
      await uploadEditorialImage(data);
      setMessage("Photo updated.");
    });
  }

  return <div className="space-y-3">
    <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => choose(event.target.files?.[0] || null)} className="sr-only"/>
    <button type="button" onClick={() => inputRef.current?.click()} disabled={pending} className="group relative block w-full overflow-hidden rounded-xl border border-forest-900/10 bg-forest-50 text-left disabled:cursor-wait" aria-label={`Change ${label.toLowerCase()}`}>
      {preview ? <Image src={preview} alt="" width={800} height={800} unoptimized={preview.startsWith("blob:")} className="aspect-square w-full object-cover"/> : <span className="flex aspect-square items-center justify-center p-6 text-center text-sm text-gray-600">Add {label.toLowerCase()}</span>}
      <span className="absolute inset-x-0 bottom-0 bg-forest-900/80 px-3 py-2 text-center text-xs font-bold text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">{pending ? "Uploading…" : "Change photo"}</span>
    </button>
    <button type="button" onClick={() => inputRef.current?.click()} disabled={pending} className="w-full rounded-xl bg-forest-800 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60">{pending ? "Uploading…" : preview ? "Replace photo" : `Add ${label}`}</button>
    <p className="text-xs leading-5 text-gray-600">JPG, PNG, or WebP · up to 12 MB</p>
    {message && <p className="text-xs leading-5 text-gray-600" role="status">{message}</p>}
  </div>;
}
