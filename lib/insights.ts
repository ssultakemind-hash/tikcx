import { admin, BUCKET } from "@/lib/supabase";
import { phase } from "@/lib/dates";
import { manualIds, readScenes, AI } from "@/lib/scenesServer";

// Long-term records that stay after photos are deleted (no photos, no guest names):
//   insights/weddings/<wedding id>.json     final numbers of a wedding, saved before its photos are deleted
//   insights/corrections/<wedding id>.json  each time the couple moved a photo the AI had sorted
// Nothing here is removed by "이 예식 삭제" or the 30-day cleanup.

export type WeddingStats = {
  wedding_id: string;
  couple_names: string | null;
  wedding_date: string | null;
  venue: string | null;
  visitors: number;
  guests: number;
  photos: number;
  videos: number;
  visit_sources: Record<string, number>;
  upload_sources: Record<string, number>;
  scenes: Record<string, number>;
  ai_sorted: number;
  hand_fixed: number;
  archived_at?: string;
};

export type Correction = { at: string; media_id: string; kind: string | null; field?: "scene" | "mood"; ai: string | null; from: string | null; to: string };

const store = () => admin().storage.from(BUCKET);
const weddingPath = (id: string) => `insights/weddings/${id}.json`;
const correctionPath = (id: string) => `insights/corrections/${id}.json`;

async function readJson<T>(path: string): Promise<T | null> {
  const { data } = await store().download(path);
  if (!data) return null;
  try { return JSON.parse(await data.text()) as T; } catch { return null; }
}
async function writeJson(path: string, value: unknown) {
  await store().upload(path, JSON.stringify(value), { upsert: true, contentType: "application/json" });
}

type WeddingRow = { id: string; couple_names: string | null; wedding_date: string | null; venue: string | null; visitors?: number | null; visit_sources?: Record<string, number> | null };

// Current numbers of a wedding, worked out from its photos and scene file.
export async function liveStats(w: WeddingRow): Promise<WeddingStats> {
  const db = admin();
  const { data: media } = await db.from("media").select("id, kind, is_pro, uploader_name, device_id, source, scene, scene_ai, scene_manual")
    .eq("wedding_id", w.id).eq("uploaded", true).limit(20000);
  const scenes = await readScenes(w.id);
  const manual = new Set(manualIds(scenes));
  const ai = (scenes[AI] && typeof scenes[AI] === "object" ? scenes[AI] : {}) as Record<string, string>;
  const guests = new Set<string>();
  const bySource = new Map<string, Set<string>>();
  const sceneCount: Record<string, number> = {};
  let photos = 0, videos = 0, aiSorted = 0, handFixed = 0;
  for (const m of media ?? []) {
    m.kind === "video" ? videos++ : photos++;
    if (!m.is_pro) {
      const who = m.device_id ?? `name:${m.uploader_name}`;
      guests.add(who);
      const src = m.source ?? "direct";
      if (!bySource.has(src)) bySource.set(src, new Set());
      bySource.get(src)!.add(who);
    }
    const s = m.scene ?? (typeof scenes[m.id] === "string" ? scenes[m.id] : null);
    const said = m.scene_ai ?? ai[m.id] ?? null;
    const byHand = m.scene_manual || manual.has(m.id);
    if (s) {
      sceneCount[s] = (sceneCount[s] ?? 0) + 1;
      if (byHand && said && said !== s) handFixed++;
      if (said) aiSorted++;
    }
  }
  return {
    wedding_id: w.id, couple_names: w.couple_names, wedding_date: w.wedding_date, venue: w.venue,
    visitors: w.visitors ?? 0, guests: guests.size, photos, videos,
    visit_sources: w.visit_sources ?? {},
    upload_sources: Object.fromEntries([...bySource].map(([k, v]) => [k, v.size])),
    scenes: sceneCount, ai_sorted: aiSorted, hand_fixed: handFixed,
  };
}

// Saves a wedding's final numbers once, right before its photos are deleted.
// Guest-facing names are left out; the couple's names are dropped from the archive too.
export async function archiveWedding(w: WeddingRow) {
  if (await readJson(weddingPath(w.id))) return; // already archived
  const s = await liveStats(w);
  if (s.photos + s.videos === 0 && s.visitors === 0) return; // nothing worth keeping
  await writeJson(weddingPath(w.id), { ...s, couple_names: null, archived_at: new Date().toISOString() });
}

export async function recordCorrection(w: WeddingRow, c: Correction) {
  const file = (await readJson<{ wedding_date: string | null; venue: string | null; items: Correction[] }>(correctionPath(w.id)))
    ?? { wedding_date: w.wedding_date, venue: w.venue, items: [] };
  file.items.push(c);
  await writeJson(correctionPath(w.id), file);
}

async function listFolder(folder: string): Promise<string[]> {
  const names: string[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data } = await store().list(folder, { limit: 1000, offset });
    if (!data?.length) break;
    names.push(...data.filter((f) => f.name.endsWith(".json")).map((f) => `${folder}/${f.name}`));
    if (data.length < 1000) break;
  }
  return names;
}

// Everything for the admin export: archived weddings + weddings still running.
export async function allStats(): Promise<(WeddingStats & { status: string })[]> {
  const db = admin();
  const archived = new Map<string, WeddingStats>();
  for (const p of await listFolder("insights/weddings")) {
    const s = await readJson<WeddingStats>(p);
    if (s) archived.set(s.wedding_id, s);
  }
  const { data: rows } = await db.from("weddings").select("id, couple_names, wedding_date, venue, visitors, visit_sources").limit(1000);
  const out: (WeddingStats & { status: string })[] = [];
  for (const w of rows ?? []) {
    const a = archived.get(w.id);
    if (a) { out.push({ ...a, couple_names: w.couple_names, status: "보관 종료" }); archived.delete(w.id); continue; }
    const p = phase(w.wedding_date);
    out.push({ ...(await liveStats(w)), status: p.expired ? "보관 종료" : p.uploadOpen ? "진행 중" : "업로드 마감" });
  }
  for (const a of archived.values()) out.push({ ...a, status: "삭제된 예식" });
  return out.sort((x, y) => String(y.wedding_date ?? "").localeCompare(String(x.wedding_date ?? "")));
}

export async function allCorrections() {
  const out: (Correction & { wedding_date: string | null; venue: string | null })[] = [];
  for (const p of await listFolder("insights/corrections")) {
    const f = await readJson<{ wedding_date: string | null; venue: string | null; items: Correction[] }>(p);
    f?.items.forEach((c) => out.push({ ...c, wedding_date: f.wedding_date, venue: f.venue }));
  }
  return out.sort((a, b) => b.at.localeCompare(a.at));
}
