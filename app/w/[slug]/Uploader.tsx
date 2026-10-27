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
  const [skipped, setSkipped] = useState(0);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const all = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!all.length) return;
    const ok = all.filter((f) => f.size <= MAX_BYTES).slice(0, MAX);
    setSkipped(all.length - ok.length);
    if (!ok.length) { setError("50MB가 넘는 파일은 올릴 수 없어요. 짧은 영상으로 나눠 올려주세요."); return; }
    setError(""); setState("busy"); setProgress({ done: 0, total: ok.length, frac: 0 });
    try {
      const r = await uploadFiles(slug, ok, name, (done, total, frac) => setProgress({ done, total, frac }), adminKey);
      setResult(r); setState("done"); onDone?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "업로드에 실패했어요. 다시 시도해주세요.");
      setState("idle");
    }
  }

  const pct = progress.total ? ((progress.done + (progress.done < progress.total ? progress.frac : 0)) / progress.total) * 100 : 0;

  if (state === "done" && result) {
    return (
      <div className="done">
        <div className="check" aria-hidden="true">✓</div>
        <h2>소중한 추억이 잘 전달되었어요</h2>
        <p className="muted">
          {result.photos ? `사진 ${result.photos}장` : ""}{result.photos && result.videos ? ", " : ""}{result.videos ? `영상 ${result.videos}개` : ""}
          {result.ok ? "가 두 분의 앨범에 담겼어요." : ""}
        </p>
        {(result.failed > 0 || skipped > 0) && (
          <p className="err">{result.failed + skipped}개는 올리지 못했어요. 와이파이나 파일 크기를 확인하고 다시 올려주세요.</p>
        )}
        <button className="btn ghost" type="button" onClick={() => { setState("idle"); setResult(null); }}>더 올리기</button>
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
          <p className="muted" style={{ marginBottom: 8 }}>올리는 중… {Math.min(progress.done + 1, progress.total)} / {progress.total} · 화면을 닫지 말아주세요</p>
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
