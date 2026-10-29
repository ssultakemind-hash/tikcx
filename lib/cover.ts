"use client";

// Shrinks a photo to at most 1800px on the long side (JPEG) so the cover loads fast.
async function shrink(file: File, max = 1800): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image(); img.src = url; await img.decode();
    const s = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement("canvas");
    c.width = Math.round(img.naturalWidth * s); c.height = Math.round(img.naturalHeight * s);
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    return await new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("encode"))), "image/jpeg", 0.86));
  } finally { URL.revokeObjectURL(url); }
}

type Auth = { adminKey?: string; k?: string };

async function call(slug: string, auth: Auth, payload: Record<string, unknown>) {
  const r = await fetch("/api/cover", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ slug, ...auth, ...payload }) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || "실패했어요.");
  return d;
}

export async function uploadCover(slug: string, auth: Auth, file: File): Promise<string | null> {
  const blob = await shrink(file);
  const { path, uploadUrl } = await call(slug, auth, { step: "start" });
  const put = await fetch(uploadUrl, { method: "PUT", headers: { "content-type": "image/jpeg", "x-upsert": "false" }, body: blob });
  if (!put.ok) throw new Error("사진을 올리지 못했어요.");
  const { url } = await call(slug, auth, { step: "done", path });
  return url;
}

export async function removeCover(slug: string, auth: Auth) {
  await call(slug, auth, { step: "remove" });
}
