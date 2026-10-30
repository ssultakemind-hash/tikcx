import { after, NextResponse } from "next/server";
import { admin, BUCKET, weddingBySlug } from "@/lib/supabase";
import { checkNew } from "@/lib/sorting";

export const maxDuration = 60;

// Adds a preview to a video that was uploaded without one. The couple's album makes the
// preview from the first frame; step "start" gives an upload link, step "done" saves it.
export async function POST(req: Request) {
  const b = await req.json().catch(() => null);
  const wedding = await weddingBySlug(String(b?.slug ?? ""));
  if (!wedding || b?.k !== wedding.couple_key) return NextResponse.json({ error: "권한이 없어요." }, { status: 403 });
  const db = admin();
  const { data: m } = await db.from("media").select("id, kind, thumb_path").eq("id", String(b?.id ?? "")).eq("wedding_id", wedding.id).maybeSingle();
  if (!m || m.kind !== "video") return NextResponse.json({ error: "영상을 찾을 수 없어요." }, { status: 404 });
  if (m.thumb_path) return NextResponse.json({ ok: true, already: true });
  const path = `${wedding.id}/thumb_${m.id}.jpg`;
  if (b?.step === "start") {
    const { data, error } = await db.storage.from(BUCKET).createSignedUploadUrl(path, { upsert: true });
    if (error || !data) return NextResponse.json({ error: "준비하지 못했어요." }, { status: 500 });
    return NextResponse.json({ uploadUrl: data.signedUrl });
  }
  if (b?.step === "done") {
    const { data: f } = await db.storage.from(BUCKET).download(path);
    if (!f || f.size < 500) return NextResponse.json({ error: "미리보기가 올라가지 않았어요." }, { status: 400 });
    await db.from("media").update({ thumb_path: path }).eq("id", m.id);
    after(() => checkNew(wedding.id, [m.id]).catch(() => {}));
    const { data: s } = await db.storage.from(BUCKET).createSignedUrl(path, 60 * 60 * 6);
    return NextResponse.json({ ok: true, thumb: s?.signedUrl ?? null });
  }
  return NextResponse.json({ error: "step" }, { status: 400 });
}
