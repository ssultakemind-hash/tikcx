import { NextResponse } from "next/server";
import { admin, BUCKET, MAX_FILE_BYTES, MAX_FILES_PER_BATCH, weddingBySlug } from "@/lib/supabase";
import { phase } from "@/lib/dates";

type FileReq = { name: string; type: string; size: number; hasThumb: boolean };

// Issues one-time signed upload URLs so files go straight from the phone to storage.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const slug: string = body?.slug ?? "";
  const files: FileReq[] = Array.isArray(body?.files) ? body.files : [];
  const uploader = String(body?.uploader ?? "").trim().slice(0, 30) || "익명 하객";
  const isPro = !!body?.adminKey && body.adminKey === process.env.ADMIN_KEY;
  const device = typeof body?.deviceId === "string" && /^[0-9a-f-]{36}$/.test(body.deviceId) ? body.deviceId : null;

  const wedding = await weddingBySlug(slug);
  if (!wedding) return NextResponse.json({ error: "예식을 찾을 수 없습니다." }, { status: 404 });
  if (!isPro && !phase(wedding.wedding_date).uploadOpen)
    return NextResponse.json({ error: "사진 올리기 기간이 끝났어요." }, { status: 403 });
  if (files.length === 0 || files.length > MAX_FILES_PER_BATCH)
    return NextResponse.json({ error: `한 번에 1~${MAX_FILES_PER_BATCH}개까지 올릴 수 있습니다.` }, { status: 400 });

  const db = admin();
  const out = [];
  for (const f of files) {
    const kind = f.type?.startsWith("video/") ? "video" : f.type?.startsWith("image/") ? "image" : null;
    if (!kind) { out.push({ error: "사진이나 영상만 올릴 수 있습니다." }); continue; }
    if (!(f.size > 0) || f.size > MAX_FILE_BYTES) { out.push({ error: "파일당 50MB까지 올릴 수 있습니다." }); continue; }

    const id = crypto.randomUUID();
    const ext = (f.name.split(".").pop() || (kind === "video" ? "mp4" : "jpg")).toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5);
    const path = `${wedding.id}/${id}.${ext}`;
    const thumbPath = f.hasThumb ? `${wedding.id}/thumb_${id}.jpg` : null;

    const main = await db.storage.from(BUCKET).createSignedUploadUrl(path);
    if (main.error) { out.push({ error: "업로드 준비에 실패했습니다." }); continue; }
    let thumb = null;
    if (thumbPath) {
      const t = await db.storage.from(BUCKET).createSignedUploadUrl(thumbPath);
      if (!t.error) thumb = t.data.signedUrl;
    }

    const ins = await db.from("media").insert({
      id, wedding_id: wedding.id, kind, path, thumb_path: thumb ? thumbPath : null,
      uploader_name: isPro ? "TAKEMIND" : uploader, is_pro: isPro, size_bytes: f.size, device_id: device,
    });
    if (ins.error) { out.push({ error: "업로드 준비에 실패했습니다." }); continue; }

    out.push({ id, uploadUrl: main.data.signedUrl, thumbUrl: thumb });
  }
  return NextResponse.json({ files: out });
}
