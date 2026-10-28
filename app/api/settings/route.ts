import { NextResponse } from "next/server";
import { admin, weddingBySlug } from "@/lib/supabase";

// Couple changes their album settings.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const wedding = await weddingBySlug(body?.slug ?? "");
  if (!wedding || body?.k !== wedding.couple_key)
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  if (typeof body?.guest_gallery !== "boolean")
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  const { error } = await admin().from("weddings").update({ guest_gallery: body.guest_gallery }).eq("id", wedding.id);
  if (error) return NextResponse.json({ error: "저장하지 못했어요." }, { status: 500 });
  return NextResponse.json({ guest_gallery: body.guest_gallery });
}
