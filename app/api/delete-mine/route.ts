import { NextResponse } from "next/server";
import { admin, BUCKET, weddingBySlug } from "@/lib/supabase";

// A guest removes a photo they uploaded by mistake. Only the phone that uploaded it
// can do this: the file's saved device id must match the one kept on that phone.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const device = typeof body?.deviceId === "string" && /^[0-9a-f-]{36}$/.test(body.deviceId) ? body.deviceId : null;
  const wedding = await weddingBySlug(String(body?.slug ?? ""));
  if (!wedding || !device) return NextResponse.json({ error: "지울 수 없어요." }, { status: 403 });

  const db = admin();
  const { data: row } = await db.from("media").select("id, path, thumb_path, device_id, is_pro")
    .eq("id", String(body?.id ?? "")).eq("wedding_id", wedding.id).maybeSingle();
  if (!row) return NextResponse.json({ ok: true }); // already gone
  if (row.is_pro || row.device_id !== device) return NextResponse.json({ error: "이 휴대폰에서 올린 사진만 지울 수 있어요." }, { status: 403 });

  await db.storage.from(BUCKET).remove([row.path, ...(row.thumb_path ? [row.thumb_path] : [])]);
  await db.from("media").delete().eq("id", row.id);
  return NextResponse.json({ ok: true });
}
