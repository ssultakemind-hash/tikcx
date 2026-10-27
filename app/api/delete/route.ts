import { NextResponse } from "next/server";
import { admin, BUCKET, weddingBySlug } from "@/lib/supabase";

// Couple removes one photo or video (file and record).
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const wedding = await weddingBySlug(body?.slug ?? "");
  if (!wedding || body?.k !== wedding.couple_key)
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });

  const db = admin();
  const { data: row } = await db
    .from("media").select("id, path, thumb_path")
    .eq("id", body?.id ?? "").eq("wedding_id", wedding.id).maybeSingle();
  if (!row) return NextResponse.json({ error: "이미 삭제되었습니다." }, { status: 404 });

  await db.storage.from(BUCKET).remove([row.path, ...(row.thumb_path ? [row.thumb_path] : [])]);
  await db.from("media").delete().eq("id", row.id);
  return NextResponse.json({ ok: true });
}
