import { NextResponse } from "next/server";
import { allCorrections, allStats } from "@/lib/insights";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Studio admin: long-term records for the "데이터 내보내기" buttons.
export async function GET(req: Request) {
  if (!process.env.ADMIN_KEY || (req.headers.get("x-admin-key") ?? "").trim() !== process.env.ADMIN_KEY.trim())
    return NextResponse.json({ error: "관리자 키가 올바르지 않습니다." }, { status: 401 });
  const type = new URL(req.url).searchParams.get("type");
  if (type === "stats") return NextResponse.json({ rows: await allStats() });
  if (type === "corrections") return NextResponse.json({ rows: await allCorrections() });
  return NextResponse.json({ error: "type=stats 또는 corrections" }, { status: 400 });
}
