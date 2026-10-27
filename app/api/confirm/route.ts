import { NextResponse } from "next/server";
import { admin, weddingBySlug } from "@/lib/supabase";

// Marks files as uploaded once the phone finished sending them.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const ids: string[] = Array.isArray(body?.ids) ? body.ids.slice(0, 50) : [];
  const wedding = await weddingBySlug(body?.slug ?? "");
  if (!wedding || ids.length === 0) return NextResponse.json({ ok: false }, { status: 400 });
  await admin().from("media").update({ uploaded: true }).eq("wedding_id", wedding.id).in("id", ids);
  return NextResponse.json({ ok: true });
}
