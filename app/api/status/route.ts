import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Which optional features are switched on (no secrets, just yes/no).
export async function GET() {
  return NextResponse.json({ ai: !!process.env.ANTHROPIC_API_KEY });
}
