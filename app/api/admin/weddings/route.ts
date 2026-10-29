import { NextResponse } from "next/server";
import { admin, BUCKET } from "@/lib/supabase";

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
    .from("weddings").select("id, slug, couple_names, wedding_date, venue, couple_key, cover_path, created_at")
    .order("wedding_date", { ascending: false, nullsFirst: false }).limit(200);
  const { data: media } = await db.from("media").select("wedding_id, kind, is_pro, uploader_name").eq("uploaded", true).limit(100000);
  const stats = new Map<string, { photos: number; videos: number; guests: Set<string> }>();
  media?.forEach((m) => {
    const s = stats.get(m.wedding_id) ?? { photos: 0, videos: 0, guests: new Set<string>() };
    m.kind === "video" ? s.videos++ : s.photos++;
    if (!m.is_pro) s.guests.add(m.uploader_name);
    stats.set(m.wedding_id, s);
  });
  const covers = new Map<string, string>();
  const coverPaths = (weddings ?? []).map((w) => w.cover_path).filter(Boolean) as string[];
  if (coverPaths.length) {
    const { data } = await db.storage.from(BUCKET).createSignedUrls(coverPaths, 60 * 60 * 6);
    data?.forEach((s) => s.path && s.signedUrl && covers.set(s.path, s.signedUrl));
  }
  return NextResponse.json({
    weddings: (weddings ?? []).map(({ cover_path, ...w }) => {
      const s = stats.get(w.id);
      return { ...w, cover_url: cover_path ? covers.get(cover_path) ?? null : null, photos: s?.photos ?? 0, videos: s?.videos ?? 0, guests: s?.guests.size ?? 0 };
    }),
  });
}

// Studio admin: delete a wedding with all its photos and videos.
export async function DELETE(req: Request) {
  const body = await req.json().catch(() => null);
  if (!authorized(body?.key ?? null))
    return NextResponse.json({ error: "관리자 키가 올바르지 않습니다." }, { status: 401 });
  const db = admin();
  const { data: w } = await db.from("weddings").select("id, cover_path").eq("id", body?.id ?? "").maybeSingle();
  if (w?.cover_path) await db.storage.from(BUCKET).remove([w.cover_path]);
  if (!w) return NextResponse.json({ error: "이미 삭제된 예식입니다." }, { status: 404 });
  for (;;) {
    const { data: rows } = await db.from("media").select("id, path, thumb_path").eq("wedding_id", w.id).limit(200);
    if (!rows?.length) break;
    await db.storage.from(BUCKET).remove(rows.flatMap((r) => (r.thumb_path ? [r.path, r.thumb_path] : [r.path])));
    await db.from("media").delete().in("id", rows.map((r) => r.id));
  }
  const { error } = await db.from("weddings").delete().eq("id", w.id);
  if (error) return NextResponse.json({ error: "삭제하지 못했어요." }, { status: 500 });
  return NextResponse.json({ ok: true });
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
