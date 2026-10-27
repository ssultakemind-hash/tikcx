import { NextResponse } from "next/server";
import { admin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

function authorized(key: string | null) {
  return !!process.env.ADMIN_KEY && key === process.env.ADMIN_KEY;
}

// Studio admin: list weddings with upload counts.
export async function GET(req: Request) {
  if (!authorized(new URL(req.url).searchParams.get("key")))
    return NextResponse.json({ error: "관리자 키가 올바르지 않습니다." }, { status: 401 });
  const db = admin();
  const { data: weddings } = await db
    .from("weddings").select("id, slug, couple_names, wedding_date, venue, couple_key, created_at")
    .order("wedding_date", { ascending: false, nullsFirst: false }).limit(200);
  const { data: media } = await db.from("media").select("wedding_id, kind, is_pro, uploader_name").eq("uploaded", true).limit(100000);
  const stats = new Map<string, { photos: number; videos: number; guests: Set<string> }>();
  media?.forEach((m) => {
    const s = stats.get(m.wedding_id) ?? { photos: 0, videos: 0, guests: new Set<string>() };
    m.kind === "video" ? s.videos++ : s.photos++;
    if (!m.is_pro) s.guests.add(m.uploader_name);
    stats.set(m.wedding_id, s);
  });
  return NextResponse.json({
    weddings: (weddings ?? []).map((w) => {
      const s = stats.get(w.id);
      return { ...w, photos: s?.photos ?? 0, videos: s?.videos ?? 0, guests: s?.guests.size ?? 0 };
    }),
  });
}

// Studio admin: create a wedding.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!authorized(body?.key ?? null))
    return NextResponse.json({ error: "관리자 키가 올바르지 않습니다." }, { status: 401 });
  const couple = String(body?.couple_names ?? "").trim().slice(0, 40);
  const slug = String(body?.slug ?? "").trim().toLowerCase();
  if (!couple) return NextResponse.json({ error: "신랑·신부 이름을 입력하세요." }, { status: 400 });
  if (!/^[a-z0-9-]{3,40}$/.test(slug))
    return NextResponse.json({ error: "주소는 영문 소문자, 숫자, 하이픈 3~40자로 입력하세요." }, { status: 400 });

  const { data, error } = await admin().from("weddings").insert({
    slug, couple_names: couple,
    wedding_date: body?.wedding_date || null,
    venue: String(body?.venue ?? "").trim().slice(0, 60) || null,
  }).select("slug").single();
  if (error) {
    const dup = error.code === "23505";
    return NextResponse.json({ error: dup ? "이미 쓰고 있는 주소입니다." : "예식을 만들지 못했습니다." }, { status: dup ? 409 : 500 });
  }
  return NextResponse.json({ slug: data.slug });
}
