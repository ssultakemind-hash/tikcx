"use client";
import { useState } from "react";
import { removeCover, uploadCover } from "@/lib/cover";

// Pick, change or remove the cover photo. Used by the studio admin and the couple.
export default function CoverPicker({ slug, auth, initialUrl, onChange }: {
  slug: string; auth: { adminKey?: string; k?: string }; initialUrl: string | null; onChange?: (url: string | null) => void;
}) {
  const [url, setUrl] = useState(initialUrl);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const id = `cover-${slug}`;

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; e.target.value = "";
    if (!f) return;
    setBusy(true); setError("");
    try { const u = await uploadCover(slug, auth, f); setUrl(u); onChange?.(u); }
    catch (err) { setError(err instanceof Error ? err.message : "사진을 올리지 못했어요."); }
    setBusy(false);
  }
  async function remove() {
    setBusy(true); setError("");
    try { await removeCover(slug, auth); setUrl(null); onChange?.(null); }
    catch (err) { setError(err instanceof Error ? err.message : "지우지 못했어요."); }
    setBusy(false);
  }

  return (
    <div className="cover-picker">
      {url ? <img className="cover-thumb" src={url} alt="대표 사진" /> : <div className="cover-thumb empty-thumb">대표 사진 없음</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
        <label className="pick" htmlFor={id}>
          <input id={id} type="file" accept="image/*" onChange={pick} disabled={busy} />
          <span className="btn ghost small" role="button">{busy ? "올리는 중…" : url ? "사진 바꾸기" : "대표 사진 올리기"}</span>
        </label>
        {url && !busy && <button className="btn ghost small" type="button" onClick={remove}>사진 빼기</button>}
        {error && <p className="err">{error}</p>}
      </div>
    </div>
  );
}
