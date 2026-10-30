import { NextResponse } from "next/server";
import { admin, BUCKET, weddingBySlug } from "@/lib/supabase";
import { classify, readScenes, writeScenes } from "@/lib/scenesServer";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const PER_REQUEST = 6;   // photos per AI request
const PARALLEL = 3;      // AI requests at once → up to 18 photos per call to this route

// Sorts not-yet-sorted photos of one wedding into scenes, a batch at a time.
// The page keeps calling this until `left` is 0. Couple key or admin key required.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const wedding = await weddingBySlug(String(body?.slug ?? ""));
  const isAdmin = !!process.env.ADMIN_KEY && body?.key === process.env.ADMIN_KEY;
  if (!wedding || (!isAdmin && body?.k !== wedding.couple_key))
    return NextResponse.json({ error: "링크가 올바르지 않습니다." }, { status: 403 });
  if (!process.env.ANTHROPIC_API_KEY)
    return NextResponse.json({ error: "AI 기능이 아직 연결되지 않았어요." }, { status: 503 });

  const db = admin();
  const { data: rows } = await db.from("media").select("id, thumb_path")
    .eq("wedding_id", wedding.id).eq("uploaded", true).not("thumb_path", "is", null)
    .order("created_at", { ascending: true }).limit(3000);
  const scenes = body?.reset === true ? {} : await readScenes(wedding.id);
  const todo = (rows ?? []).filter((r) => !scenes[r.id]);
  const batch = todo.slice(0, PER_REQUEST * PARALLEL);

  if (batch.length) {
    const groups: { id: string; path: string }[][] = [];
    batch.forEach((r, i) => { (groups[Math.floor(i / PER_REQUEST)] ??= []).push({ id: r.id, path: r.thumb_path as string }); });
    let failed = 0;
    let lastError = "";
    await Promise.all(groups.map(async (g) => {
      try {
        const labels = await classify(g.map((x) => x.path));
        g.forEach((x, i) => { scenes[x.id] = labels[i]; });
      } catch (e) { failed += g.length; lastError = String(e instanceof Error ? e.message : e); }
    }));
    if (failed < batch.length) await writeScenes(wedding.id, scenes);
    if (failed === batch.length) {
      console.error("scene classify failed", lastError);
      return NextResponse.json({ error: "AI가 사진을 분류하지 못했어요. 잠시 뒤 다시 해주세요.", detail: lastError.slice(0, 300) }, { status: 502 });
    }
  }

  const left = (rows ?? []).filter((r) => !scenes[r.id]).length;
  return NextResponse.json({ done: (rows ?? []).length - left, left, scenes });
}
