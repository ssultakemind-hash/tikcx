import { NextResponse } from "next/server";
import { admin, BUCKET, coverUrl, weddingBySlug } from "@/lib/supabase";

// Cover photo for a wedding. The studio (admin key) or the couple (couple key) can set it.
// step "start": returns a one-time upload URL. step "done": makes the uploaded file the cover.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const wedding = await weddingBySlug(body?.slug ?? "");
  if (!wedding) return NextResponse.json({ error: "예식을 찾을 수 없어요." }, { status: 404 });
  const isAdmin = !!process.env.ADMIN_KEY && body?.adminKey === process.env.ADMIN_KEY;
  const isCouple = body?.k === wedding.couple_key;
  if (!isAdmin && !isCouple) return NextResponse.json({ error: "권한이 없어요." }, { status: 403 });

  const db = admin();
  const prefix = `${wedding.id}/cover_`;

  if (body?.step === "start") {
    const path = `${prefix}${crypto.randomUUID()}.jpg`;
    const { data, error } = await db.storage.from(BUCKET).createSignedUploadUrl(path);
    if (error) return NextResponse.json({ error: "업로드를 준비하지 못했어요." }, { status: 500 });
    return NextResponse.json({ path, uploadUrl: data.signedUrl });
  }

  if (body?.step === "done") {
    const path = String(body?.path ?? "");
    if (!path.startsWith(prefix) || path.includes("..")) return NextResponse.json({ error: "잘못된 요청이에요." }, { status: 400 });
    const old = wedding.cover_path;
    const { error } = await db.from("weddings").update({ cover_path: path }).eq("id", wedding.id);
    if (error) return NextResponse.json({ error: "저장하지 못했어요." }, { status: 500 });
    if (old && old !== path) await db.storage.from(BUCKET).remove([old]);
    return NextResponse.json({ url: await coverUrl(path) });
  }

  if (body?.step === "remove") {
    if (wedding.cover_path) await db.storage.from(BUCKET).remove([wedding.cover_path]);
    await db.from("weddings").update({ cover_path: null }).eq("id", wedding.id);
    return NextResponse.json({ url: null });
  }

  return NextResponse.json({ error: "잘못된 요청이에요." }, { status: 400 });
}
