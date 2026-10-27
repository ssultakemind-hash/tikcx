"use client";
import { useCallback, useEffect, useState } from "react";
import QRCode from "qrcode";
import Uploader from "../w/[slug]/Uploader";

type W = { id: string; slug: string; couple_names: string; wedding_date: string | null; venue: string | null; couple_key: string; photos: number; videos: number; guests: number };

export default function Admin() {
  const [key, setKey] = useState("");
  const [authed, setAuthed] = useState(false);
  const [list, setList] = useState<W[]>([]);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ couple_names: "", wedding_date: "", venue: "", slug: "" });
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => { try { const s = sessionStorage.getItem("tikcx_admin"); if (s) setKey(s); } catch {} }, []);

  const load = useCallback(async (k = key) => {
    const r = await fetch(`/api/admin/weddings?key=${encodeURIComponent(k)}`, { cache: "no-store" });
    const d = await r.json();
    if (!r.ok) { setError(d.error); setAuthed(false); return; }
    setError(""); setAuthed(true); setList(d.weddings);
    try { sessionStorage.setItem("tikcx_admin", k); } catch {}
  }, [key]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch("/api/admin/weddings", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ key, ...form }) });
    const d = await r.json();
    if (!r.ok) { setError(d.error); return; }
    setForm({ couple_names: "", wedding_date: "", venue: "", slug: "" });
    setOpen(d.slug); load();
  }

  if (!authed) {
    return (
      <main className="wrap">
        <div className="brand">tikcx<small>스튜디오 관리자</small></div>
        <form className="card" onSubmit={(e) => { e.preventDefault(); load(); }}>
          <h1>관리자 로그인</h1>
          <div className="field"><label htmlFor="admin-key">관리자 키</label>
            <input id="admin-key" type="password" value={key} onChange={(e) => setKey(e.target.value)} autoComplete="current-password" /></div>
          {error && <p className="err">{error}</p>}
          <button className="btn" type="submit">들어가기</button>
        </form>
      </main>
    );
  }

  return (
    <main className="wrap wide">
      <div className="brand">tikcx<small>스튜디오 관리자</small></div>
      <form className="card" onSubmit={create}>
        <h2>새 예식 만들기</h2>
        <div className="field"><label htmlFor="f-names">신랑·신부 이름</label>
          <input id="f-names" placeholder="민준 ♥ 서연" value={form.couple_names} onChange={(e) => setForm({ ...form, couple_names: e.target.value })} required /></div>
        <div className="field"><label htmlFor="f-date">예식일</label>
          <input id="f-date" type="date" value={form.wedding_date} onChange={(e) => setForm({ ...form, wedding_date: e.target.value })} /></div>
        <div className="field"><label htmlFor="f-venue">예식장</label>
          <input id="f-venue" placeholder="예: 더채플앳청담" value={form.venue} onChange={(e) => setForm({ ...form, venue: e.target.value })} /></div>
        <div className="field"><label htmlFor="f-slug">QR 주소 (영문)</label>
          <input id="f-slug" placeholder="mj-sy-1121" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase() })} required /></div>
        {error && <p className="err">{error}</p>}
        <button className="btn" type="submit">예식 만들기</button>
      </form>

      <section className="card">
        <h2>예식 목록</h2>
        {list.length === 0 && <div className="empty">아직 만든 예식이 없어요. 위에서 첫 예식을 만들어보세요.</div>}
        <div className="list">
          {list.map((w) => <WeddingRow key={w.id} w={w} adminKey={key} expanded={open === w.slug} onToggle={() => setOpen(open === w.slug ? null : w.slug)} />)}
        </div>
      </section>
    </main>
  );
}

function WeddingRow({ w, adminKey, expanded, onToggle }: { w: W; adminKey: string; expanded: boolean; onToggle: () => void }) {
  const [qr, setQr] = useState("");
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const guestUrl = `${origin}/w/${w.slug}`;
  const coupleUrl = `${origin}/c/${w.slug}?k=${w.couple_key}`;

  useEffect(() => {
    if (expanded) QRCode.toDataURL(guestUrl, { width: 1024, margin: 2, color: { dark: "#141615", light: "#ffffff" } }).then(setQr).catch(() => {});
  }, [expanded, guestUrl]);

  const copy = (t: string) => navigator.clipboard?.writeText(t).catch(() => {});

  return (
    <div className="item">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div><b>{w.couple_names}</b><p className="muted">{[w.wedding_date, w.venue].filter(Boolean).join(" · ")} · 사진 {w.photos} · 영상 {w.videos} · 하객 {w.guests}명</p></div>
        <button className="btn ghost small" type="button" onClick={onToggle}>{expanded ? "접기" : "열기"}</button>
      </div>
      {expanded && (
        <>
          <div className="row" style={{ alignItems: "flex-start" }}>
            {qr && <img className="qr" src={qr} alt={`${w.couple_names} 업로드 QR`} />}
            <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1, minWidth: 0 }}>
              <p className="muted">하객 업로드 주소 (QR)</p>
              <div className="url">{guestUrl}</div>
              <div className="row">
                <button className="btn ghost small" type="button" onClick={() => copy(guestUrl)}>주소 복사</button>
                {qr && <a className="btn ghost small" href={qr} download={`tikcx-${w.slug}-qr.png`}>QR 이미지 저장</a>}
              </div>
              <p className="muted">신랑·신부 전용 링크 (이 링크만 있으면 앨범을 볼 수 있으니 커플에게만 보내세요)</p>
              <div className="url">{coupleUrl}</div>
              <div className="row">
                <a className="btn small" href={coupleUrl} target="_blank" rel="noopener">앨범 보기</a>
                <button className="btn ghost small" type="button" onClick={() => copy(coupleUrl)}>링크 복사</button>
              </div>
            </div>
          </div>
          <Uploader slug={w.slug} adminKey={adminKey} />
        </>
      )}
    </div>
  );
}
