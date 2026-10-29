import { NextResponse } from "next/server";
import { admin, weddingBySlug } from "@/lib/supabase";
import { INTERESTS, LEAD_KEEP_DAYS, normalizePhone, STATUSES, TIMINGS } from "@/lib/leads";

export const dynamic = "force-dynamic";

function isAdmin(key: unknown) {
  return !!process.env.ADMIN_KEY && key === process.env.ADMIN_KEY;
}

// A guest who is getting married leaves their contact (with consent).
export async function POST(req: Request) {
  const b = await req.json().catch(() => null);
  const name = String(b?.name ?? "").trim().slice(0, 30);
  const phone = normalizePhone(String(b?.phone ?? ""));
  const timing = TIMINGS.includes(b?.timing) ? b.timing : null;
  const interests = Array.isArray(b?.interests) ? b.interests.filter((i: unknown) => INTERESTS.includes(i as never)).slice(0, 4) : [];
  if (b?.consent !== true) return NextResponse.json({ error: "개인정보 수집·이용에 동의해 주세요." }, { status: 400 });
  if (!name) return NextResponse.json({ error: "이름을 적어주세요." }, { status: 400 });
  if (!phone) return NextResponse.json({ error: "휴대폰 번호를 확인해 주세요." }, { status: 400 });
  if (!timing) return NextResponse.json({ error: "결혼 예정 시기를 골라주세요." }, { status: 400 });

  const wedding = await weddingBySlug(String(b?.slug ?? ""));
  const device = typeof b?.deviceId === "string" && /^[0-9a-f-]{36}$/.test(b.deviceId) ? b.deviceId : null;
  const db = admin();
  // one entry per phone number: a repeat updates the existing one
  const { data: existing } = await db.from("leads").select("id").eq("phone", phone).maybeSingle();
  const row = {
    name, phone, timing, interests, marketing: b?.marketing === true, device_id: device,
    wedding_id: wedding?.id ?? null, wedding_label: wedding?.couple_names ?? null,
  };
  const { error } = existing
    ? await db.from("leads").update(row).eq("id", existing.id)
    : await db.from("leads").insert(row);
  if (error) return NextResponse.json({ error: "저장하지 못했어요. 잠시 후 다시 시도해 주세요." }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// Studio admin: list (also removes entries older than 1 year).
export async function GET(req: Request) {
  if (!isAdmin(new URL(req.url).searchParams.get("key"))) return NextResponse.json({ error: "권한이 없어요." }, { status: 401 });
  const db = admin();
  const cutoff = new Date(Date.now() - LEAD_KEEP_DAYS * 86400_000).toISOString();
  await db.from("leads").delete().lt("created_at", cutoff);
  const { data } = await db.from("leads")
    .select("id, name, phone, timing, interests, marketing, status, memo, wedding_label, created_at")
    .order("created_at", { ascending: false }).limit(2000);
  return NextResponse.json({ leads: data ?? [] });
}

// Studio admin: change status or memo.
export async function PATCH(req: Request) {
  const b = await req.json().catch(() => null);
  if (!isAdmin(b?.key)) return NextResponse.json({ error: "권한이 없어요." }, { status: 401 });
  const patch: Record<string, unknown> = {};
  if (STATUSES.some((s) => s.id === b?.status)) patch.status = b.status;
  if (typeof b?.memo === "string") patch.memo = b.memo.slice(0, 500);
  if (!Object.keys(patch).length) return NextResponse.json({ error: "바꿀 내용이 없어요." }, { status: 400 });
  const { error } = await admin().from("leads").update(patch).eq("id", b?.id ?? "");
  if (error) return NextResponse.json({ error: "저장하지 못했어요." }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// Studio admin: delete (e.g. the person asked to withdraw).
export async function DELETE(req: Request) {
  const b = await req.json().catch(() => null);
  if (!isAdmin(b?.key)) return NextResponse.json({ error: "권한이 없어요." }, { status: 401 });
  await admin().from("leads").delete().eq("id", b?.id ?? "");
  return NextResponse.json({ ok: true });
}
