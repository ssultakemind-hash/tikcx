import { NextResponse } from "next/server";
import { admin, BUCKET, coverUrl, weddingBySlug } from "@/lib/supabase";
import { phase } from "@/lib/dates";

export const dynamic = "force-dynamic";

// Couple-only gallery. Requires the secret couple key from the couple link.
export async function GET(req: Request) {
  const u = new URL(req.url);
  const wedding = await weddingBySlug(u.searchParams.get("slug") ?? "");
  if (!wedding || u.searchParams.get("k") !== wedding.couple_key)
    return NextResponse.json({ error: "링크가 올바르지 않습니다." }, { status: 403 });

  const db = admin();
  const { data: rows } = await db
    .from("media")
    .select("id, kind, path, thumb_path, uploader_name, is_pro, created_at")
    .eq("wedding_id", wedding.id)
    .eq("uploaded", true)
    .order("created_at", { ascending: false })
    .limit(2000);

  const list = rows ?? [];
  const paths = list.flatMap((r) => (r.thumb_path ? [r.path, r.thumb_path] : [r.path]));
  const signed = new Map<string, string>();
  for (let i = 0; i < paths.length; i += 500) {
    const { data } = await db.storage.from(BUCKET).createSignedUrls(paths.slice(i, i + 500), 60 * 60 * 6);
    data?.forEach((s) => s.path && s.signedUrl && signed.set(s.path, s.signedUrl));
  }

  return NextResponse.json({
    wedding: { couple_names: wedding.couple_names, wedding_date: wedding.wedding_date, venue: wedding.venue, guest_gallery: wedding.guest_gallery },
    phase: phase(wedding.wedding_date),
    cover: await coverUrl(wedding.cover_path, 60 * 60 * 6),
    items: list.map((r) => ({
      id: r.id, kind: r.kind, from: r.uploader_name, pro: r.is_pro, at: r.created_at,
      url: signed.get(r.path) ?? null,
      thumb: r.thumb_path ? signed.get(r.thumb_path) ?? null : null,
    })),
  });
}
