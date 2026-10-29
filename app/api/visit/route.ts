import { NextResponse } from "next/server";
import { admin, weddingBySlug } from "@/lib/supabase";

// Counts a guest's first visit to a wedding page (the phone remembers it was counted).
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const wedding = await weddingBySlug(body?.slug ?? "");
  if (!wedding) return NextResponse.json({ ok: false }, { status: 404 });
  const { error } = await admin().rpc("inc_visitors", { wid: wedding.id });
  return NextResponse.json({ ok: !error });
}
