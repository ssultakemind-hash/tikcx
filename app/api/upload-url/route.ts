import { NextResponse } from "next/server";
import { admin, BUCKET, MAX_FILE_BYTES, MAX_FILES_PER_BATCH, weddingBySlug } from "@/lib/supabase";
import { phase } from "@/lib/dates";
import { cleanSource } from "@/lib/sources";
import { isProKey } from "@/lib/proToken";

export const maxDuration = 60;
const PER_DEVICE = 300;
const PER_WEDDING = 5000;

type FileReq = { name: string; type: string; size: number; hasThumb: boolean };

// Issues one-time signed upload URLs so files go straight from the phone to storage.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const slug: string = body?.slug ?? "";
  const files: FileReq[] = Array.isArray(body?.files) ? body.files : [];
  const uploader = String(body?.uploader ?? "").trim().slice(0, 30) || "익명 하객";
  const device = typeof body?.deviceId === "string" && /^[0-9a-f-]{36}$/.test(body.deviceId) ? body.deviceId : null;

  const wedding = await weddingBySlug(slug);
  if (!wedding) return NextResponse.json({ error: "예식을 찾을 수 없습니다." }, { status: 404 });
  // admin key, or the photographer link key for this wedding
  const isPro = isProKey(wedding.id, body?.adminKey);
  if (!isPro && !phase(wedding.wedding_date).uploadOpen)
    return NextResponse.json({ error: "사진 올리기 기간이 끝났어요." }, { status: 403 });
  if (files.length === 0 || files.length > MAX_FILES_PER_BATCH)
    return NextResponse.json({ error: `한 번에 1~${MAX_FILES_PER_BATCH}개까지 올릴 수 있습니다.` }, { status: 400 });

  const db = admin();
  // Limits against misuse: one phone can send up to PER_DEVICE files per wedding,
  // and a wedding takes up to PER_WEDDING files in total.
  if (!isPro) {
    const [{ count: mine }, { count: all }] = await Promise.all([
      device ? db.from("media").select("id", { count: "exact", head: true }).eq("wedding_id", wedding.id).eq("device_id", device) : Promise.resolve({ count: 0 }),
      db.from("media").select("id", { count: "exact", head: true }).eq("wedding_id", wedding.id),
    ]);
    if ((mine ?? 0) + files.length > PER_DEVICE)
      return NextResponse.json({ error: `한 사람당 ${PER_DEVICE}개까지 올릴 수 있어요. (지금까지 ${mine ?? 0}개)` }, { status: 429 });
    if ((all ?? 0) + files.length > PER_WEDDING)
      return NextResponse.json({ error: "이 예식의 사진이 가득 찼어요. 두 사람에게 알려주세요." }, { status: 429 });
  }
  // Prepare all files at once (was one by one: 50 photos could take too long).
  const out = await Promise.all(files.map(async (f) => {
    const kind = f.type?.startsWith("video/") ? "video" : f.type?.startsWith("image/") ? "image" : null;
    if (!kind) { return { error: "사진이나 영상만 올릴 수 있습니다." }; }
    if (!(f.size > 0) || f.size > MAX_FILE_BYTES) { return { error: "파일당 50MB까지 올릴 수 있습니다." }; }

    const id = crypto.randomUUID();
    const ext = (f.name.split(".").pop() || (kind === "video" ? "mp4" : "jpg")).toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5);
    const path = `${wedding.id}/${id}.${ext}`;
    const thumbPath = f.hasThumb ? `${wedding.id}/thumb_${id}.jpg` : null;

    const [main, t] = await Promise.all([
      db.storage.from(BUCKET).createSignedUploadUrl(path),
      thumbPath ? db.storage.from(BUCKET).createSignedUploadUrl(thumbPath) : Promise.resolve(null),
    ]);
    if (main.error) { return { error: "업로드 준비에 실패했습니다." }; }
    const thumb = t && !t.error ? t.data.signedUrl : null;

    const ins = await db.from("media").insert({
      id, wedding_id: wedding.id, kind, path, thumb_path: thumb ? thumbPath : null,
      uploader_name: isPro ? "TAKEMIND" : uploader, is_pro: isPro, size_bytes: f.size, device_id: device, source: cleanSource(body?.source),
    });
    if (ins.error) { return { error: "업로드 준비에 실패했습니다." }; }

    return { id, uploadUrl: main.data.signedUrl, thumbUrl: thumb };
  }));
  return NextResponse.json({ files: out });
}
