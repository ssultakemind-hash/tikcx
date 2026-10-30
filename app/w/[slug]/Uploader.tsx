"use client";
import { useState } from "react";
import { uploadFiles, type UploadResult } from "@/lib/upload";

const MAX = 50;
const MAX_BYTES = 50 * 1024 * 1024;

export default function Uploader({ slug, adminKey, onDone }: { slug: string; adminKey?: string; onDone?: () => void }) {
  const [name, setName] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [progress, setProgress] = useState({ done: 0, total: 0, frac: 0 });
  const [result, setResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const all = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!all.length) return;
    const small = all.filter((f) => f.size <= MAX_BYTES);
    const ok = small.slice(0, MAX);
    setNote([
      all.length > small.length ? `50MB가 넘는 파일 ${all.length - small.length}개는 빼고 올려요. (긴 영상은 30초 이내로 잘라주세요)` : "",
      small.length > MAX ? `한 번에 ${MAX}개까지라 ${small.length - MAX}개는 남았어요. 다 올라가면 '더 올리기'로 이어서 올려주세요.` : "",
    ].filter(Boolean).join(" "));
    if (!ok.length) { setError("50MB가 넘는 파일은 올릴 수 없어요. 영상은 30초 이내로 잘라서 올려주세요."); return; }
    setError(""); setState("busy"); setProgress({ done: 0, total: ok.length, frac: 0 });
    try {
      const r = await uploadFiles(slug, ok, name, (done, total, frac) => setProgress({ done, total, frac }), adminKey);
      setResult(r); setState("done"); onDone?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "업로드에 실패했어요. 다시 시도해주세요.");
      setState("idle");
    }
  }

  const pct = progress.total ? Math.min(100, ((progress.done + progress.frac) / progress.total) * 100) : 0;

  if (state === "done" && result) {
    return (
      <div className="done">
        <div className="check" aria-hidden="true">✓</div>
        <h2>소중한 추억이 잘 전달되었어요</h2>
        <p className="muted">
          {result.photos ? `사진 ${result.photos}장` : ""}{result.photos && result.videos ? ", " : ""}{result.videos ? `영상 ${result.videos}개` : ""}
          {result.ok ? "가 두 분의 앨범에 담겼어요." : ""}
        </p>
        {result.failed > 0 && <p className="err">{result.failed}개는 인터넷 연결 문제로 올리지 못했어요. 다시 올려주세요.</p>}
        {note && <p className="notice">{note}</p>}
        <button className="btn ghost" type="button" onClick={() => { setState("idle"); setResult(null); setNote(""); }}>더 올리기</button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {!adminKey && (
        <div className="field">
          <label htmlFor="uploader-name">보내는 분 (선택)</label>
          <input id="uploader-name" type="text" placeholder="예: 신랑 대학 동기 지훈" maxLength={30}
            value={name} onChange={(e) => setName(e.target.value)} disabled={state === "busy"} />
        </div>
      )}
      {state === "busy" ? (
        <div>
          <p className="muted" style={{ marginBottom: 8 }}>올리는 중… {progress.done} / {progress.total} 완료 · 화면을 닫지 말아주세요</p>
          <div className="bar"><i style={{ width: `${pct}%` }} /></div>
        </div>
      ) : (
        <label className="pick">
          <input id="files" type="file" accept="image/*,video/*" multiple onChange={onPick} />
          <span className="btn" role="button">{adminKey ? "작가 원본 올리기" : "사진 올리기"}</span>
        </label>
      )}
      {error && <p className="err">{error}</p>}
      <p className="muted">한 번에 최대 {MAX}개 · 파일당 50MB까지</p>
    </div>
  );
}
