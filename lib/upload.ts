"use client";

// Makes a small JPEG preview so the gallery loads fast on phones.
// Videos: grabs a frame near the start. iPhone Safari only loads video frames with
// preload="auto" and an explicit load(), and sometimes only after a muted play(), so all
// of that is tried. If no frame can be read (e.g. a format this browser can't decode),
// a simple "영상" card is used so the video still shows up for guests and on the screen.
async function videoFrame(url: string, remote = false): Promise<{ src: CanvasImageSource; w: number; h: number } | null> {
  const v = document.createElement("video");
  if (remote) v.crossOrigin = "anonymous";
  v.muted = true; v.playsInline = true; v.preload = "auto";
  v.setAttribute("muted", ""); v.setAttribute("playsinline", ""); v.setAttribute("webkit-playsinline", "");
  v.style.cssText = "position:fixed;left:-9999px;top:0;width:2px;height:2px;opacity:0";
  document.body.appendChild(v);
  const wait = (ev: string, ms: number) => new Promise<boolean>((res) => {
    const done = (ok: boolean) => { v.removeEventListener(ev, on); res(ok); };
    const on = () => done(true);
    v.addEventListener(ev, on, { once: true });
    setTimeout(() => done(false), ms);
  });
  try {
    v.src = url + "#t=0.1";
    v.load();
    if (!(await wait("loadedmetadata", 8000)) || !v.videoWidth) return null;
    const seeked = wait("seeked", 4000);
    v.currentTime = Math.min(0.5, (v.duration || 1) / 2);
    let ok = await seeked;
    if (!ok || v.readyState < 2) {
      // last try: a short muted play gives Safari a decoded frame
      try { await v.play(); await new Promise((r) => setTimeout(r, 300)); v.pause(); ok = v.readyState >= 2; } catch { ok = false; }
    }
    return ok ? { src: v, w: v.videoWidth, h: v.videoHeight } : null;
  } finally {
    setTimeout(() => { v.removeAttribute("src"); v.load(); v.remove(); }, 0);
  }
}

function videoCard(): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = 720; c.height = 960;
  const x = c.getContext("2d")!;
  const g = x.createLinearGradient(0, 0, 720, 960); g.addColorStop(0, "#2b2b30"); g.addColorStop(1, "#111114");
  x.fillStyle = g; x.fillRect(0, 0, 720, 960);
  x.fillStyle = "rgba(255,255,255,.9)"; x.beginPath(); x.moveTo(300, 400); x.lineTo(300, 560); x.lineTo(440, 480); x.closePath(); x.fill();
  x.font = "600 44px sans-serif"; x.textAlign = "center"; x.fillText("영상", 360, 650);
  return c;
}

export async function makeThumb(file: File): Promise<Blob | null> {
  const url = URL.createObjectURL(file);
  try {
    let source: CanvasImageSource; let w: number; let h: number;
    if (file.type.startsWith("video/")) {
      const f = await videoFrame(url).catch(() => null);
      if (f) ({ src: source, w, h } = f);
      else { const card = videoCard(); source = card; w = card.width; h = card.height; }
    } else {
      const img = new Image(); img.src = url;
      await img.decode();
      source = img; w = img.naturalWidth; h = img.naturalHeight;
    }
    if (!w || !h) return null;
    const s = Math.min(1, 1280 / Math.max(w, h));
    const c = document.createElement("canvas");
    c.width = Math.round(w * s); c.height = Math.round(h * s);
    c.getContext("2d")!.drawImage(source, 0, 0, c.width, c.height);
    return await new Promise((res) => c.toBlob((b) => res(b), "image/jpeg", 0.8));
  } catch { return null; }
  finally { URL.revokeObjectURL(url); }
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
let memoryId = "";
function newId() {
  try { return crypto.randomUUID(); } catch {
    return "xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx".replace(/x/g, () => Math.floor(Math.random() * 16).toString(16));
  }
}
export function deviceId(): string {
  try {
    let id = localStorage.getItem("tikcx_device");
    if (!id) { id = newId(); localStorage.setItem("tikcx_device", id); }
    return id;
  } catch {
    // Private mode / storage blocked: keep an id for this visit only.
    return memoryId || (memoryId = newId());
  }
}

// Counts this phone's first visit to a wedding page once, remembering where it came from
// (?from=screen / card / invite / qr). The first source wins.
export function countVisit(slug: string) {
  let source = "direct";
  try {
    const k = `tikcx_visited_${slug}`;
    if (localStorage.getItem(k)) return;
    source = new URLSearchParams(location.search).get("from") || "direct";
    localStorage.setItem(k, "1");
    localStorage.setItem(`tikcx_src_${slug}`, source);
  } catch { return; }
  fetch("/api/visit", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ slug, source }) }).catch(() => {});
}

export function visitSource(slug: string) {
  try { return localStorage.getItem(`tikcx_src_${slug}`) || "direct"; } catch { return "direct"; }
}

const mineKey = (slug: string) => `tikcx_mine_${slug}`;
export function getMine(slug: string): string[] {
  try { return JSON.parse(localStorage.getItem(mineKey(slug)) || "[]"); } catch { return []; }
}
export function removeMine(slug: string, id: string) {
  try { localStorage.setItem(mineKey(slug), JSON.stringify(getMine(slug).filter((x) => x !== id))); } catch {}
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
    body: JSON.stringify({ slug, uploader, adminKey, deviceId: deviceId(), source: visitSource(slug), files: files.map((f, i) => ({ name: f.name, type: f.type, size: f.size, hasThumb: !!thumbs[i] })) }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "업로드를 시작하지 못했습니다.");

  // Sends 3 files at a time (faster on venue Wi-Fi/LTE than one by one).
  const okIds: string[] = []; let failed = 0, photos = 0, videos = 0, done = 0;
  const inflight = new Map<number, number>();
  const report = () => onProgress(done, files.length, [...inflight.values()].reduce((a, b) => a + b, 0));
  let next = 0;
  async function worker() {
    while (next < files.length) {
      const i = next++;
      const slot = data.files[i];
      if (!slot?.uploadUrl) { failed++; done++; report(); continue; }
      inflight.set(i, 0);
      try {
        await put(slot.uploadUrl, files[i], files[i].type, (p) => { inflight.set(i, p); report(); });
        if (slot.thumbUrl && thumbs[i]) await put(slot.thumbUrl, thumbs[i]!, "image/jpeg").catch(() => {});
        okIds.push(slot.id);
        files[i].type.startsWith("video/") ? videos++ : photos++;
      } catch { failed++; }
      inflight.delete(i); done++; report();
    }
  }
  await Promise.all([worker(), worker(), worker()]);
  if (okIds.length) await fetch("/api/confirm", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ slug, ids: okIds }) });
  if (!adminKey) addMine(slug, okIds);
  return { ok: okIds.length, failed, photos, videos, ids: okIds };
}

// Makes a preview for a video that was uploaded without one (older iPhone uploads).
// Reads the first frame from the stored video. Returns null if this browser can't.
export async function thumbFromVideoUrl(url: string): Promise<Blob | null> {
  try {
    const f = await videoFrame(url, true);
    if (!f) return null;
    const s = Math.min(1, 1280 / Math.max(f.w, f.h));
    const c = document.createElement("canvas");
    c.width = Math.round(f.w * s); c.height = Math.round(f.h * s);
    c.getContext("2d")!.drawImage(f.src, 0, 0, c.width, c.height);
    return await new Promise((res) => c.toBlob((b) => res(b), "image/jpeg", 0.8));
  } catch { return null; }
}

export async function putBlob(url: string, body: Blob) {
  await put(url, body, "image/jpeg");
}
