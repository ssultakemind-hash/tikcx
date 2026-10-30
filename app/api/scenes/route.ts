import { NextResponse } from "next/server";
import { admin, weddingBySlug } from "@/lib/supabase";
import { AI, manualIds, readScenes } from "@/lib/scenesServer";
import { recordCorrection } from "@/lib/insights";
import { checkNew, resortBatch } from "@/lib/sorting";
import { MOOD_KEYS, SCENE_KEYS } from "@/lib/scenes";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Body = { slug?: string; k?: string; key?: string; reset?: boolean; id?: string; scene?: string; mood?: string; hidden?: boolean };

async function auth(body: Body | null, adminOk = false) {
  const wedding = await weddingBySlug(String(body?.slug ?? ""));
  const isAdmin = adminOk && !!process.env.ADMIN_KEY && body?.key === process.env.ADMIN_KEY;
  if (!wedding || (!isAdmin && body?.k !== wedding.couple_key)) return null;
  return wedding;
}

// Current scene of every photo (from the photo rows; older weddings fall back to the old file).
async function snapshot(weddingId: string) {
  const { data: rows } = await admin().from("media").select("id, scene, scene_manual, mood")
    .eq("wedding_id", weddingId).eq("uploaded", true).not("thumb_path", "is", null).limit(5000);
  const legacy = await readScenes(weddingId);
  const scenes: Record<string, string> = {};
  const moods: Record<string, string> = {};
  let left = 0;
  for (const r of rows ?? []) {
    const s = r.scene ?? (typeof legacy[r.id] === "string" ? legacy[r.id] : null);
    if (s) scenes[r.id] = s;
    if (r.mood) moods[r.id] = r.mood;
    if (!s || !r.mood) left++;
  }
  return { scenes, moods, left, done: (rows ?? []).length - left };
}

// Sorts photos into scenes a batch at a time; the page keeps calling until `left` is 0.
// reset=true ("다시 정리") clears scenes the couple didn't set by hand and sorts again.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as Body | null;
  const wedding = await auth(body, true);
  if (!wedding) return NextResponse.json({ error: "링크가 올바르지 않습니다." }, { status: 403 });
  if (!process.env.ANTHROPIC_API_KEY)
    return NextResponse.json({ error: "AI 기능이 아직 연결되지 않았어요." }, { status: 503 });

  const db = admin();
  if (body?.reset === true) {
    // keep hand-made choices (also those from the older file)
    const legacy = await readScenes(wedding.id);
    for (const id of manualIds(legacy)) if (typeof legacy[id] === "string")
      await db.from("media").update({ scene: legacy[id], scene_manual: true }).eq("id", id).eq("wedding_id", wedding.id);
    await db.from("media").update({ scene: null }).eq("wedding_id", wedding.id).eq("scene_manual", false);
    await db.from("media").update({ mood: null }).eq("wedding_id", wedding.id).eq("mood_manual", false);
  }
  // photos never checked first (safety + scene), then ones waiting for a new scene
  let r = await checkNew(wedding.id);
  if (!r.done && !r.error) r = await resortBatch(wedding.id);
  const s = await snapshot(wedding.id);
  if (r.error && !r.done) {
    console.error("scene sort failed", r.error);
    return NextResponse.json({ error: "AI가 사진을 분류하지 못했어요. 잠시 뒤 다시 해주세요.", detail: r.error.slice(0, 300), ...s }, { status: 502 });
  }
  // nothing could be done but some are left (e.g. being checked right now): tell the page to stop politely
  return NextResponse.json(r.done ? s : { ...s, left: 0, waiting: s.left });
}

// Couple moves one photo to another scene by hand, or hides/shows it for guests and the screen.
export async function PATCH(req: Request) {
  const body = (await req.json().catch(() => null)) as Body | null;
  const wedding = await auth(body);
  if (!wedding) return NextResponse.json({ error: "링크가 올바르지 않습니다." }, { status: 403 });
  const id = String(body?.id ?? "");
  const db = admin();
  const { data: m } = await db.from("media").select("id, kind, scene, scene_ai, mood, mood_ai").eq("id", id).eq("wedding_id", wedding.id).maybeSingle();
  if (!m) return NextResponse.json({ error: "사진을 찾을 수 없어요." }, { status: 404 });

  if (typeof body?.hidden === "boolean") {
    await db.from("media").update({ hidden: body.hidden }).eq("id", id);
    return NextResponse.json({ ok: true });
  }

  if (typeof body?.mood === "string") {
    const mood = body.mood;
    if (!MOOD_KEYS.includes(mood) && mood !== "none") return NextResponse.json({ error: "감정을 다시 골라주세요." }, { status: 400 });
    if (m.mood === mood) return NextResponse.json({ ok: true });
    await db.from("media").update({ mood, mood_manual: true }).eq("id", id);
    await recordCorrection(wedding, { at: new Date().toISOString(), media_id: id, kind: m.kind ?? null, field: "mood", ai: m.mood_ai ?? null, from: m.mood ?? null, to: mood }).catch(() => {});
    return NextResponse.json({ ok: true });
  }

  const scene = String(body?.scene ?? "");
  if (!SCENE_KEYS.includes(scene)) return NextResponse.json({ error: "장면을 다시 골라주세요." }, { status: 400 });
  const legacy = await readScenes(wedding.id);
  const from = m.scene ?? (typeof legacy[id] === "string" ? legacy[id] : null);
  if (from === scene) return NextResponse.json({ ok: true });
  await db.from("media").update({ scene, scene_manual: true }).eq("id", id);
  // Long-term record of the fix (kept after photos are deleted; no photo, no names).
  const ai = m.scene_ai ?? legacy[AI]?.[id] ?? null;
  await recordCorrection(wedding, { at: new Date().toISOString(), media_id: id, kind: m.kind ?? null, field: "scene", ai, from, to: scene }).catch(() => {});
  return NextResponse.json({ ok: true });
}
