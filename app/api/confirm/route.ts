import { after, NextResponse } from "next/server";
import { checkAllNew } from "@/lib/sorting";

export const maxDuration = 60;
import { admin, weddingBySlug } from "@/lib/supabase";

// Marks files as uploaded once the phone finished sending them.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const ids: string[] = Array.isArray(body?.ids) ? body.ids.slice(0, 50) : [];
  const wedding = await weddingBySlug(body?.slug ?? "");
  if (!wedding || ids.length === 0) return NextResponse.json({ ok: false }, { status: 400 });
  await admin().from("media").update({ uploaded: true }).eq("wedding_id", wedding.id).in("id", ids);
  // Safety check + scene sorting in the background, so the guest doesn't wait.
  after(() => checkAllNew(wedding.id, ids).catch((e) => console.error("auto check failed", e)));
  return NextResponse.json({ ok: true });
}
