import { NextResponse } from "next/server";
import { admin, BUCKET, weddingBySlug } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// Guest-facing "모두의 사진": small previews only, never originals.
// Hidden entirely when the couple turns sharing off.
export async function GET(req: Request) {
  const wedding = await weddingBySlug(new URL(req.url).searchParams.get("slug") ?? "");
  if (!wedding) return NextResponse.json({ enabled: false, items: [] }, { status: 404 });
  if (!wedding.guest_gallery) return NextResponse.json({ enabled: false, items: [] });

  const db = admin();
  const { data: rows } = await db.from("media")
    .select("id, kind, thumb_path, uploader_name, is_pro")
    .eq("wedding_id", wedding.id).eq("uploaded", true).not("thumb_path", "is", null)
    .order("created_at", { ascending: false }).limit(300);
  const list = rows ?? [];
  const signed = new Map<string, string>();
  if (list.length) {
    const { data } = await db.storage.from(BUCKET).createSignedUrls(list.map((r) => r.thumb_path as string), 60 * 60);
    data?.forEach((s) => s.path && s.signedUrl && signed.set(s.path, s.signedUrl));
  }
  return NextResponse.json({
    enabled: true,
    items: list.map((r) => ({ id: r.id, kind: r.kind, from: r.uploader_name, thumb: signed.get(r.thumb_path as string) ?? null }))
      .filter((r) => r.thumb),
  });
}
