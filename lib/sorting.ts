import { admin } from "@/lib/supabase";
import { classify, type Label } from "@/lib/scenesServer";

// Automatic check of new photos (runs right after a guest uploads):
//  1) safety: photos the AI marks "unsafe" get hidden=true → never shown on the bridal-room
//     screen or to other guests (the couple still sees them and decides)
//  2) scene: the AI's scene goes into media.scene / media.scene_ai
// While a photo is being checked, checked_at is set but scene_ai is still empty ("claimed").

const PER_REQUEST = 6;
const PARALLEL = 3;
export const SHOW_UNCHECKED_AFTER_MS = 5 * 60 * 1000; // if the AI is down, show photos after 5 minutes anyway
const STALE_CLAIM_MS = 2 * 60 * 1000;

type Row = { id: string; thumb_path: string | null; checked_at: string | null; scene_ai?: string | null };

// Takes (claims) up to `limit` unchecked photos of a wedding so two checks never run on the same photo.
async function claim(weddingId: string, limit: number, ids?: string[]): Promise<Row[]> {
  const db = admin();
  let q = db.from("media").select("id, thumb_path, checked_at, scene_ai")
    .eq("wedding_id", weddingId).eq("uploaded", true).not("thumb_path", "is", null).is("mood_ai", null)
    .order("created_at", { ascending: true }).limit(limit * 3);
  if (ids?.length) q = q.in("id", ids);
  const { data } = await q;
  const staleBefore = Date.now() - STALE_CLAIM_MS;
  const free = (data ?? []).filter((r) => !r.checked_at || new Date(r.checked_at).getTime() < staleBefore).slice(0, limit);
  if (!free.length) return [];
  const now = new Date().toISOString();
  const { data: got } = await db.from("media").update({ checked_at: now })
    .in("id", free.map((r) => r.id)).is("mood_ai", null).select("id, thumb_path, checked_at, scene_ai");
  return (got ?? []) as Row[];
}

async function save(rows: Row[], labels: Label[], moderate: boolean) {
  const db = admin();
  await Promise.all(rows.map(async (r, i) => {
    const unsafe = labels[i].scene === "unsafe";
    const scene = unsafe ? "other" : labels[i].scene;
    const mood = labels[i].mood;
    const patch: Record<string, unknown> = { scene_ai: scene, mood_ai: mood, checked_at: new Date().toISOString() };
    // safety check only the first time a photo is looked at (a photo the couple chose to show stays shown)
    if (moderate && unsafe && !r.scene_ai) patch.hidden = true;
    await db.from("media").update(patch).eq("id", r.id);
    // scene / feeling only where the couple hasn't chosen one by hand
    await db.from("media").update({ scene }).eq("id", r.id).eq("scene_manual", false);
    await db.from("media").update({ mood }).eq("id", r.id).eq("mood_manual", false);
  }));
}

async function release(rows: Row[]) {
  await admin().from("media").update({ checked_at: null }).in("id", rows.map((r) => r.id)).is("mood_ai", null);
}

// Checks up to 18 new photos of a wedding. Returns how many were done.
export async function checkNew(weddingId: string, ids?: string[]): Promise<{ done: number; error?: string }> {
  if (!process.env.ANTHROPIC_API_KEY) return { done: 0 };
  const rows = await claim(weddingId, PER_REQUEST * PARALLEL, ids);
  if (!rows.length) return { done: 0 };
  const groups: Row[][] = [];
  rows.forEach((r, i) => (groups[Math.floor(i / PER_REQUEST)] ??= []).push(r));
  let done = 0, error = "";
  await Promise.all(groups.map(async (g) => {
    try { await save(g, await classify(g.map((r) => r.thumb_path as string)), true); done += g.length; }
    catch (e) { error = String(e instanceof Error ? e.message : e); await release(g); }
  }));
  return { done, error: error || undefined };
}

// Keeps going until a wedding has no unchecked photos left (bounded so it fits in one request).
export async function checkAllNew(weddingId: string, ids?: string[], rounds = 4) {
  for (let i = 0; i < rounds; i++) {
    const r = await checkNew(weddingId, ids);
    if (!r.done) return r;
  }
  return { done: 0 };
}

// "다시 정리": re-sort scenes of photos the couple hasn't fixed by hand (safety result is kept).
export async function resortBatch(weddingId: string): Promise<{ done: number; error?: string }> {
  const db = admin();
  const { data } = await db.from("media").select("id, thumb_path, checked_at, scene_ai")
    .eq("wedding_id", weddingId).eq("uploaded", true).not("thumb_path", "is", null)
    .or("scene.is.null,mood.is.null").order("created_at", { ascending: true }).limit(PER_REQUEST * PARALLEL);
  const rows = (data ?? []) as Row[];
  if (!rows.length) return { done: 0 };
  const groups: Row[][] = [];
  rows.forEach((r, i) => (groups[Math.floor(i / PER_REQUEST)] ??= []).push(r));
  let done = 0, error = "";
  await Promise.all(groups.map(async (g) => {
    try { await save(g, await classify(g.map((r) => r.thumb_path as string)), false); done += g.length; }
    catch (e) { error = String(e instanceof Error ? e.message : e); }
  }));
  return { done, error: error || undefined };
}

// Photos other guests and the bridal-room screen may see.
export function visibleToGuests(r: { hidden?: boolean | null; checked_at?: string | null; scene_ai?: string | null; created_at: string; thumb_path?: string | null }) {
  if (r.hidden) return false;
  if (r.thumb_path === null) return true; // a video without preview: shown only as a "▶ 영상" tile
  if (!process.env.ANTHROPIC_API_KEY) return true;
  if (r.scene_ai) return true; // checked and safe (checked once already)
  return Date.now() - new Date(r.created_at).getTime() > SHOW_UNCHECKED_AFTER_MS;
}
