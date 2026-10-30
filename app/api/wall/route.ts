import { after, NextResponse } from "next/server";
import { admin, BUCKET, weddingBySlug } from "@/lib/supabase";
import { readScenes } from "@/lib/scenesServer";
import { checkNew, visibleToGuests } from "@/lib/sorting";

export const maxDuration = 60;

export const dynamic = "force-dynamic";

// Guest-facing "모두의 사진": small previews only, never originals.
// Hidden entirely when the couple turns sharing off.
export async function GET(req: Request) {
  const wedding = await weddingBySlug(new URL(req.url).searchParams.get("slug") ?? "");
  if (!wedding) return NextResponse.json({ enabled: false, items: [] }, { status: 404 });
  if (!wedding.guest_gallery) return NextResponse.json({ enabled: false, items: [] });

  const db = admin();
  const { data: rows } = await db.from("media")
    .select("id, kind, thumb_path, uploader_name, is_pro, scene, scene_ai, mood_ai, hidden, checked_at, created_at, mood")
    .eq("wedding_id", wedding.id).eq("uploaded", true).or("thumb_path.not.is.null,kind.eq.video")
    .order("created_at", { ascending: false }).limit(300);
  const all = rows ?? [];
  // A photo the automatic check missed (e.g. a failed background run) gets checked now.
  if (all.some((r) => r.thumb_path && !r.mood_ai && Date.now() - new Date(r.created_at).getTime() > 30_000))
    after(() => checkNew(wedding.id).catch(() => {}));
  const list = all.filter(visibleToGuests);
  const scenes = await readScenes(wedding.id); // older weddings sorted before scenes moved into the photo rows
  const signed = new Map<string, string>();
  if (list.length) {
    const { data } = await db.storage.from(BUCKET).createSignedUrls(list.filter((r) => r.thumb_path).map((r) => r.thumb_path as string), 60 * 60);
    data?.forEach((s) => s.path && s.signedUrl && signed.set(s.path, s.signedUrl));
  }
  return NextResponse.json({
    enabled: true,
    items: list.map((r) => ({ id: r.id, kind: r.kind, from: r.uploader_name, scene: r.scene ?? (typeof scenes[r.id] === "string" ? scenes[r.id] : null), mood: r.mood && r.mood !== "none" ? r.mood : null, thumb: r.thumb_path ? signed.get(r.thumb_path) ?? null : null }))
      .filter((r) => r.thumb || r.kind === "video"),
  });
}
