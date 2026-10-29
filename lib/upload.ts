"use client";

// Makes a small JPEG preview so the gallery loads fast on phones.
export async function makeThumb(file: File): Promise<Blob | null> {
  try {
    const url = URL.createObjectURL(file);
    let source: CanvasImageSource; let w: number; let h: number;
    if (file.type.startsWith("video/")) {
      const v = document.createElement("video");
      v.muted = true; v.playsInline = true; v.preload = "metadata"; v.src = url;
      await new Promise<void>((res, rej) => { v.onloadeddata = () => res(); v.onerror = () => rej(); setTimeout(rej, 6000); });
      v.currentTime = Math.min(1, (v.duration || 2) / 2);
      await new Promise<void>((res) => { v.onseeked = () => res(); setTimeout(res, 3000); });
      source = v; w = v.videoWidth; h = v.videoHeight;
    } else {
      const img = new Image(); img.src = url;
      await img.decode();
      source = img; w = img.naturalWidth; h = img.naturalHeight;
    }
    if (!w || !h) return null;
    const s = Math.min(1, 640 / Math.max(w, h));
    const c = document.createElement("canvas");
    c.width = Math.round(w * s); c.height = Math.round(h * s);
    c.getContext("2d")!.drawImage(source, 0, 0, c.width, c.height);
    URL.revokeObjectURL(url);
    return await new Promise((res) => c.toBlob((b) => res(b), "image/jpeg", 0.8));
  } catch { return null; }
}

function put(url: string, body: Blob, type: string, onProgress?: (p: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("content-type", type || "application/octet-stream");
    xhr.setRequestHeader("x-upsert", "false");
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(e.loaded / e.total);
    xhr.onload = () => (xhr.status < 300 ? resolve() : reject(new Error(String(xhr.status))));
    xhr.onerror = () => reject(new Error("network"));
    xhr.send(body);
  });
}

export type UploadResult = { ok: number; failed: number; photos: number; videos: number; ids: string[] };

// Remembers, on this phone only, which files this guest uploaded.
// A random id for this phone, so we can count how many different guests uploaded
// (names are optional and many people stay "익명 하객").
export function deviceId(): string {
  try {
    let id = localStorage.getItem("tikcx_device");
    if (!id) { id = crypto.randomUUID(); localStorage.setItem("tikcx_device", id); }
    return id;
  } catch { return ""; }
}

// Counts this phone's first visit to a wedding page once.
export function countVisit(slug: string) {
  try {
    const k = `tikcx_visited_${slug}`;
    if (localStorage.getItem(k)) return;
    localStorage.setItem(k, "1");
  } catch { return; }
  fetch("/api/visit", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ slug }) }).catch(() => {});
}

const mineKey = (slug: string) => `tikcx_mine_${slug}`;
export function getMine(slug: string): string[] {
  try { return JSON.parse(localStorage.getItem(mineKey(slug)) || "[]"); } catch { return []; }
}
export function addMine(slug: string, ids: string[]) {
  try { localStorage.setItem(mineKey(slug), JSON.stringify([...ids, ...getMine(slug)].slice(0, 500))); } catch {}
}

// Uploads files one by one and reports overall progress (0..1).
export async function uploadFiles(
  slug: string, files: File[], uploader: string, onProgress: (done: number, total: number, frac: number) => void, adminKey?: string,
): Promise<UploadResult> {
  const thumbs = await Promise.all(files.map(makeThumb));
  const res = await fetch("/api/upload-url", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ slug, uploader, adminKey, deviceId: deviceId(), files: files.map((f, i) => ({ name: f.name, type: f.type, size: f.size, hasThumb: !!thumbs[i] })) }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "업로드를 시작하지 못했습니다.");

  const okIds: string[] = []; let failed = 0, photos = 0, videos = 0;
  for (let i = 0; i < files.length; i++) {
    const slot = data.files[i];
    if (!slot?.uploadUrl) { failed++; onProgress(i + 1, files.length, 1); continue; }
    try {
      await put(slot.uploadUrl, files[i], files[i].type, (p) => onProgress(i, files.length, p));
      if (slot.thumbUrl && thumbs[i]) await put(slot.thumbUrl, thumbs[i]!, "image/jpeg").catch(() => {});
      okIds.push(slot.id);
      files[i].type.startsWith("video/") ? videos++ : photos++;
    } catch { failed++; }
    onProgress(i + 1, files.length, 1);
  }
  if (okIds.length) await fetch("/api/confirm", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ slug, ids: okIds }) });
  if (!adminKey) addMine(slug, okIds);
  return { ok: okIds.length, failed, photos, videos, ids: okIds };
}
