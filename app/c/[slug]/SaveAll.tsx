"use client";
import { useEffect, useRef, useState } from "react";
import { zipSync } from "fflate";

type Item = { id: string; kind: "image" | "video"; url: string | null };

const ZIP_PART_BYTES = 200 * 1024 * 1024; // computers: one zip per ~200MB
const SHARE_BATCH = 10;                   // iPhone: 10 at a time to the Photos app
const SHARE_BATCH_BYTES = 80 * 1024 * 1024;

function isAndroid() {
  return typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent);
}
function isIOS() {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}
function canShareFiles() {
  try { return !!navigator.canShare && navigator.canShare({ files: [new File([""], "a.jpg", { type: "image/jpeg" })] }); } catch { return false; }
}
function extOf(url: string, kind: string) {
  try { const e = new URL(url).pathname.split(".").pop() || ""; if (/^[a-z0-9]{2,5}$/i.test(e)) return e.toLowerCase(); } catch {}
  return kind === "video" ? "mp4" : "jpg";
}
async function fetchFile(it: Item, n: number, tag = ""): Promise<File> {
  const r = await fetch(it.url!);
  if (!r.ok) throw new Error("fetch");
  const b = await r.blob();
  return new File([b], `tikcx${tag ? "_" + tag : ""}_${String(n).padStart(3, "0")}.${extOf(it.url!, it.kind)}`, { type: b.type || (it.kind === "video" ? "video/mp4" : "image/jpeg") });
}
function saveBlob(blob: Blob, name: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 60_000);
}

// Saves the photos currently shown (전체, a scene like 축가, 사진 only, 영상 only):
// iPhone → 10 at a time into the Photos app; Galaxy/Android → one file each (shows in Gallery);
// computer → zip files. `label` names the selection, e.g. "축가".
export default function SaveAll({ slug, items, label, fileTag, albumUrl }: { slug: string; items: Item[]; label?: string; fileTag?: string; albumUrl?: string }) {
  const list = items.filter((i) => i.url);
  // English-only file names: some phones and browsers drop Korean names ("download").
  const tag = (fileTag ?? "").replace(/[^a-z0-9_-]+/gi, "");
  const [mode] = useState<"zip" | "share" | "files">(() => (isIOS() && canShareFiles() ? "share" : isAndroid() ? "files" : "zip"));
  const [linkCopied, setLinkCopied] = useState(false);
  const pcLink = albumUrl && mode !== "zip" && (
    <button className="btn ghost small" type="button" onClick={() => { navigator.clipboard?.writeText(albumUrl).then(() => { setLinkCopied(true); setTimeout(() => setLinkCopied(false), 2000); }).catch(() => {}); }}>
      {linkCopied ? "복사됐어요. PC 카톡이나 메일로 보내서 여세요" : "PC에서 한 번에 받기 (앨범 주소 복사)"}
    </button>
  );
  const what = label ? `'${label}'` : "사진과 영상";

  // ---- one file each (Android: lands in Download, visible in Gallery) ----
  const [fileState, setFileState] = useState<{ busy: boolean; done: number; msg: string }>({ busy: false, done: 0, msg: "" });
  async function downloadEach() {
    setFileState({ busy: true, done: 0, msg: "" });
    let failed = 0;
    for (let i = 0; i < list.length; i++) {
      try { const f = await fetchFile(list[i], i + 1, tag); saveBlob(f, f.name); await new Promise((r) => setTimeout(r, 400)); }
      catch { failed++; }
      setFileState({ busy: true, done: i + 1, msg: "" });
    }
    setFileState({ busy: false, done: list.length, msg: failed ? `${failed}개는 받지 못했어요. 다시 시도해 주세요.` : "저장했어요. 갤러리 앱이나 '내 파일 > 다운로드'에서 볼 수 있어요." });
  }

  // ---- zip (computer, Android) ----
  const [zipState, setZipState] = useState<{ busy: boolean; done: number; msg: string }>({ busy: false, done: 0, msg: "" });
  async function downloadZip() {
    setZipState({ busy: true, done: 0, msg: "" });
    let part = 1, size = 0, failed = 0;
    let files: Record<string, Uint8Array> = {};
    const flush = () => {
      if (!Object.keys(files).length) return;
      const data = zipSync(files, { level: 0 });
      saveBlob(new Blob([data], { type: "application/zip" }), `tikcx-${slug}${tag ? "-" + tag : ""}-${part}.zip`);
      part++; files = {}; size = 0;
    };
    for (let i = 0; i < list.length; i++) {
      try {
        const f = await fetchFile(list[i], i + 1, tag);
        const buf = new Uint8Array(await f.arrayBuffer());
        if (size + buf.length > ZIP_PART_BYTES) flush();
        files[f.name] = buf; size += buf.length;
      } catch { failed++; }
      setZipState({ busy: true, done: i + 1, msg: "" });
    }
    flush();
    setZipState({ busy: false, done: list.length, msg: failed ? `${failed}개는 받지 못했어요. 다시 시도해 주세요.` : `저장했어요. 다운로드 폴더를 확인해 주세요.${part > 2 ? ` (${part - 1}개 파일로 나눠 저장)` : ""}` });
  }

  // ---- share to Photos (iPhone) ----
  const [start, setStart] = useState(0);
  const [ready, setReady] = useState<File[] | null>(null);
  const [shareMsg, setShareMsg] = useState("");
  const preparing = useRef(false);
  useEffect(() => {
    if (mode !== "share" || start >= list.length || ready || preparing.current) return;
    preparing.current = true;
    (async () => {
      const out: File[] = []; let bytes = 0;
      for (let i = start; i < list.length && out.length < SHARE_BATCH; i++) {
        try {
          const f = await fetchFile(list[i], i + 1, tag);
          if (out.length && bytes + f.size > SHARE_BATCH_BYTES) break;
          out.push(f); bytes += f.size;
        } catch { /* skip broken file */ out.push(new File([], "skip")); }
      }
      setReady(out);
      preparing.current = false;
    })();
  }, [mode, start, ready, list]);

  async function shareBatch() {
    if (!ready) return;
    const files = ready.filter((f) => f.size > 0);
    try {
      if (files.length) await navigator.share({ files });
      setStart((s) => s + ready.length); setReady(null); setShareMsg("");
    } catch (e) {
      if ((e as Error)?.name !== "AbortError") setShareMsg("저장하지 못했어요. 다시 눌러 주세요.");
    }
  }

  if (!list.length) return null;

  if (mode === "share") {
    const done = start >= list.length;
    const end = Math.min(list.length, start + (ready?.length ?? SHARE_BATCH));
    return (
      <div className="panel save">
        <div><h2>{label ? `'${label}' 사진 앱에 저장` : "사진 앱에 전체 저장"}</h2>
          <p className="muted">{what} {list.length}개 · 버튼을 누르고 <b>'이미지 저장'</b>을 고르면 {SHARE_BATCH}개씩 사진 앱에 들어가요.</p></div>
        {done ? <p className="ok">전부 저장했어요 ({list.length}개)</p> : (
          <button className="btn" type="button" onClick={shareBatch} disabled={!ready}>
            {ready ? `저장하기 (${start + 1}~${end} / ${list.length})` : `준비 중… (${start + 1}~ / ${list.length})`}
          </button>
        )}
        <div className="bar"><i style={{ width: `${(start / list.length) * 100}%` }} /></div>
        {shareMsg && <p className="err">{shareMsg}</p>}
        {pcLink}
      </div>
    );
  }

  if (mode === "files") {
    return (
      <div className="panel save">
        <div><h2>{label ? `'${label}' 갤러리에 저장` : "갤러리에 전체 저장"}</h2>
          <p className="muted">{what} {list.length}개를 원본 그대로 받아요. 처음 한 번 '여러 파일 다운로드 허용'을 눌러주세요. 와이파이에서 해주세요.</p></div>
        <button className="btn" type="button" onClick={downloadEach} disabled={fileState.busy}>
          {fileState.busy ? `받는 중… ${fileState.done} / ${list.length}` : `저장하기 (${list.length}개)`}
        </button>
        {fileState.busy && <div className="bar"><i style={{ width: `${(fileState.done / list.length) * 100}%` }} /></div>}
        {fileState.msg && <p className="muted">{fileState.msg}</p>}
        {pcLink}
      </div>
    );
  }

  return (
    <div className="panel save">
      <div><h2>{label ? `'${label}' 저장` : "전체 저장"}</h2>
        <p className="muted">{what} {list.length}개를 원본 그대로 한 번에 받아요. 와이파이에서 해주세요.</p></div>
      <button className="btn" type="button" onClick={downloadZip} disabled={zipState.busy}>
        {zipState.busy ? `받는 중… ${zipState.done} / ${list.length}` : `저장하기 (zip · ${list.length}개)`}
      </button>
      {zipState.busy && <div className="bar"><i style={{ width: `${(zipState.done / list.length) * 100}%` }} /></div>}
      {zipState.msg && <p className="muted">{zipState.msg}</p>}
    </div>
  );
}
