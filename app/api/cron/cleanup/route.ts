import { NextResponse } from "next/server";
import { admin, BUCKET } from "@/lib/supabase";
import { addDays, KEEP_DAYS, kstToday } from "@/lib/dates";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Runs once a day (vercel.json). Deletes photos and videos of weddings whose
// 30-day album period has ended. Weddings without a date are never deleted.
// Safe to run any number of times: it only removes what is already expired.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const db = admin();
  const cutoff = addDays(kstToday(), -KEEP_DAYS); // wedding_date <= cutoff means expired
  const { data: weddings } = await db.from("weddings").select("id, slug, cover_path").not("wedding_date", "is", null).lte("wedding_date", cutoff);

  const report: { slug: string; removed: number }[] = [];
  for (const w of weddings ?? []) {
    let removed = 0;
    for (;;) {
      const { data: rows } = await db.from("media").select("id, path, thumb_path").eq("wedding_id", w.id).limit(200);
      if (!rows?.length) break;
      const paths = rows.flatMap((r) => (r.thumb_path ? [r.path, r.thumb_path] : [r.path]));
      await db.storage.from(BUCKET).remove(paths);
      await db.from("media").delete().in("id", rows.map((r) => r.id));
      removed += rows.length;
    }
    if (w.cover_path) {
      await db.storage.from(BUCKET).remove([w.cover_path]);
      await db.from("weddings").update({ cover_path: null }).eq("id", w.id);
      removed++;
    }
    if (removed) report.push({ slug: w.slug, removed });
  }
  return NextResponse.json({ ok: true, cutoff, report });
}
