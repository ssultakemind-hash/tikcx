import { NextResponse } from "next/server";
import { admin, weddingBySlug } from "@/lib/supabase";
import { cleanSource } from "@/lib/sources";

// Counts a guest's first visit to a wedding page, and where they came from.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const wedding = await weddingBySlug(body?.slug ?? "");
  if (!wedding) return NextResponse.json({ ok: false }, { status: 404 });
  const { error } = await admin().rpc("inc_visit", { wid: wedding.id, src: cleanSource(body?.source) });
  return NextResponse.json({ ok: !error });
}
