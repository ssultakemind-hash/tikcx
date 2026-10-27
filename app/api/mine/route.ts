import { NextResponse } from "next/server";
import { admin, BUCKET, weddingBySlug } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// A guest sees only the files they uploaded. The random file ids, kept on
// their phone, act as proof; nobody else's photos are returned.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const ids: string[] = Array.isArray(body?.ids)
    ? body.ids.filter((x: unknown) => typeof x === "string" && /^[0-9a-f-]{36}$/.test(x)).slice(0, 500) : [];
  const wedding = await weddingBySlug(body?.slug ?? "");
  if (!wedding || ids.length === 0) return NextResponse.json({ items: [] });

  const db = admin();
  const { data: rows } = await db.from("media")
    .select("id, kind, path, thumb_path, created_at")
    .eq("wedding_id", wedding.id).eq("uploaded", true).in("id", ids)
    .order("created_at", { ascending: false });
  const list = rows ?? [];
  const paths = list.flatMap((r) => (r.thumb_path ? [r.path, r.thumb_path] : [r.path]));
  const signed = new Map<string, string>();
  if (paths.length) {
    const { data } = await db.storage.from(BUCKET).createSignedUrls(paths, 60 * 60);
    data?.forEach((s) => s.path && s.signedUrl && signed.set(s.path, s.signedUrl));
  }
  return NextResponse.json({
    items: list.map((r) => ({
      id: r.id, kind: r.kind,
      url: signed.get(r.path) ?? null,
      thumb: r.thumb_path ? signed.get(r.thumb_path) ?? null : null,
    })),
  });
}
