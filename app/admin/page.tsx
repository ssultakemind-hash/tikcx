"use client";
import { useCallback, useEffect, useState } from "react";
import QRCode from "qrcode";
import SaveImageButton from "../SaveImageButton";
import TableCard from "../TableCard";
import Leads from "./Leads";
import { SOURCES, withSource } from "@/lib/sources";
import { shortUrl, useCopy } from "@/lib/copy";
import { daysBetween, kstToday, phase, shortDate, WARN_DAYS } from "@/lib/dates";
import CoverPicker from "../CoverPicker";

function coupleMessage(names: string, url: string) {
  return `[TAKEMIND] ${names}님, 결혼 진심으로 축하드려요.

하객분들이 찍어주신 사진과 영상을 한곳에 모아드리는 tikcx 앨범을 준비했어요.

▶ 두 분 전용 앨범
${url}

앨범 위쪽 '하객 초대하기'에서 모바일 청첩장에 넣을 링크와 QR을 받으실 수 있어요.
예식 당일 테이블 QR 카드는 TAKEMIND가 준비해 드립니다.

※ 위 링크는 두 분만 보관해 주세요. 하객분들께는 '하객 초대하기'의 링크를 보내주시면 돼요.`;
}

function dayAfterMessage(w: W, url: string) {
  const p = phase(w.wedding_date);
  return `[TAKEMIND] ${w.couple_names}님, 결혼을 다시 한번 축하드려요.

하객분들이 사진 ${w.photos}장${w.videos ? `, 영상 ${w.videos}개` : ""}를 보내주셨어요.

▶ 두 분 전용 앨범
${url}

하객 사진은 ${shortDate(p.uploadUntil)}까지 더 올라올 수 있어요.
앨범은 ${shortDate(p.deleteOn)}까지 보관되니, 앨범의 '전체 저장'으로 꼭 저장해 두세요.`;
}

function deleteSoonMessage(w: W, url: string) {
  const p = phase(w.wedding_date);
  return `[TAKEMIND] ${w.couple_names}님, tikcx 앨범 보관 기간이 ${p.daysLeft}일 남았어요.

${shortDate(p.deleteOn)}에 모든 사진과 영상이 삭제돼요.

▶ 두 분 전용 앨범
${url}

앨범에서 '전체 저장'을 눌러 미리 저장해 주세요.`;
}

type Todo = { w: W; type: "dayafter" | "deletesoon"; label: string; text: string };

function todosFor(list: W[], origin: string): Todo[] {
  const today = kstToday();
  const out: Todo[] = [];
  for (const w of list) {
    if (!w.wedding_date) continue;
    const url = `${origin}/c/${w.slug}?k=${w.couple_key}`;
    const p = phase(w.wedding_date, today);
    const since = daysBetween(w.wedding_date, today);
    if (since >= 1 && since <= 2) out.push({ w, type: "dayafter", label: "예식 다음날 · 사진 모임 안내", text: dayAfterMessage(w, url) });
    if (p.daysLeft !== null && p.daysLeft > 0 && p.daysLeft <= WARN_DAYS && w.photos + w.videos > 0)
      out.push({ w, type: "deletesoon", label: `삭제 ${p.daysLeft}일 전 · 저장 안내`, text: deleteSoonMessage(w, url) });
  }
  return out;
}

function TodayList({ list }: { list: W[] }) {
  const { copied, copy } = useCopy();
  const [sent, setSent] = useState<Record<string, boolean>>({});
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const todos = todosFor(list, origin);
  const key = (t: Todo) => `tikcx_sent_${t.w.id}_${t.type}`;

  useEffect(() => {
    const s: Record<string, boolean> = {};
    try { todos.forEach((t) => { if (localStorage.getItem(key(t))) s[key(t)] = true; }); } catch {}
    setSent(s);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list]);

  function markSent(t: Todo) {
    try { localStorage.setItem(key(t), "1"); } catch {}
    setSent((s) => ({ ...s, [key(t)]: true }));
  }

  const pending = todos.filter((t) => !sent[key(t)]);

  return (
    <section className="card">
      <div>
        <div className="eyebrow">오늘 할 일</div>
        <h2>카톡 보낼 예식 {pending.length > 0 ? pending.length : ""}</h2>
      </div>
      {pending.length === 0 ? (
        <p className="muted">오늘은 보낼 카톡이 없어요.</p>
      ) : (
        <div className="list">
          {pending.map((t) => (
            <div key={key(t)} className="item">
              <div><b>{t.w.couple_names}</b><p className="muted">{t.label}</p></div>
              <button className="btn" type="button" onClick={() => copy(t.text, key(t))}>
                {copied === key(t) ? "복사됐어요. 카톡에 붙여넣기 하세요" : "카톡 문구 복사"}
              </button>
              <button className="btn ghost small" type="button" onClick={() => markSent(t)}>보냈어요</button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

type W = { id: string; slug: string; couple_names: string; wedding_date: string | null; venue: string | null; couple_key: string; cover_url: string | null; visitors: number; visit_sources: Record<string, number>; upload_sources: Record<string, number>; photos: number; videos: number; guests: number };

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
        <div className="brand"><span className="logo" aria-label="tikcx">tikcx<i>.</i></span><small>스튜디오 관리자</small></div>
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
      <div className="brand"><span className="logo" aria-label="tikcx">tikcx<i>.</i></span><small>스튜디오 관리자</small></div>
      <TodayList list={list} />
      <Leads adminKey={key} />
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
          {list.map((w) => <WeddingRow key={w.id} w={w} adminKey={key} expanded={open === w.slug} onToggle={() => setOpen(open === w.slug ? null : w.slug)} onDeleted={() => { setOpen(null); load(); }} />)}
        </div>
      </section>
    </main>
  );
}

function WeddingRow({ w, adminKey, expanded, onToggle, onDeleted }: { w: W; adminKey: string; expanded: boolean; onToggle: () => void; onDeleted: () => void }) {
  const [qr, setQr] = useState("");
  const [cover, setCover] = useState(w.cover_url);
  const [armed, setArmed] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [delError, setDelError] = useState("");
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const guestUrl = `${origin}/w/${w.slug}`;
  const coupleUrl = `${origin}/c/${w.slug}?k=${w.couple_key}`;

  useEffect(() => {
    if (expanded) QRCode.toDataURL(withSource(guestUrl, "qr"), { width: 1024, margin: 2, color: { dark: "#141615", light: "#ffffff" } }).then(setQr).catch(() => {});
  }, [expanded, guestUrl]);

  const { copied, copy } = useCopy();
  const kakao = coupleMessage(w.couple_names, coupleUrl);

  return (
    <div className="item">
      <div className="row" style={{ justifyContent: "space-between", flexWrap: "nowrap", alignItems: "center" }}>
        {cover ? <img className="row-cover" src={cover} alt="" /> : <div className="row-cover empty-thumb" aria-hidden="true" />}
        <div style={{ minWidth: 0, flex: 1 }}>
          <b>{w.couple_names}</b>
          <p className="muted">{[shortDate(w.wedding_date), w.venue].filter(Boolean).join(" · ")}</p>
          <p className="muted">사진 {w.photos} · 영상 {w.videos}</p>
          <p className="muted">방문 {w.visitors}명 · 올린 하객 {w.guests}명{w.visitors > 0 ? ` · 업로드율 ${Math.min(100, Math.round((w.guests / w.visitors) * 100))}%` : ""}</p>
          {w.wedding_date && (() => {
            const p = phase(w.wedding_date);
            return <p className="muted">{p.expired ? "보관 종료" : `업로드 ${shortDate(p.uploadUntil)}까지${p.uploadOpen ? "" : " (마감)"} · 삭제 ${shortDate(p.deleteOn)}`}</p>;
          })()}
        </div>
        <button className="btn ghost small" type="button" onClick={onToggle}>{expanded ? "접기" : "열기"}</button>
      </div>
      {expanded && (
        <>
          <div className="panel">
            <div className="panel-head"><span className="pill">대표 사진</span><span className="muted">하객 페이지 맨 위에 크게 나와요</span></div>
            <CoverPicker slug={w.slug} auth={{ adminKey }} initialUrl={w.cover_url} onChange={setCover} />
          </div>

          <div className="panel">
            <div className="panel-head"><span className="pill">신랑·신부</span><span className="muted">두 사람에게만 보내세요</span></div>
            <button className="btn" type="button" onClick={() => copy(kakao, "kakao")}>
              {copied === "kakao" ? "복사됐어요. 카톡에 붙여넣기 하세요" : "카톡 안내 문구 복사"}
            </button>
            <div className="row two">
              <a className="btn ghost small" href={`${coupleUrl}&from=admin`}>앨범 보기</a>
              <button className="btn ghost small" type="button" onClick={() => copy(coupleUrl, "couple")}>{copied === "couple" ? "복사됨" : "링크만 복사"}</button>
            </div>
          </div>

          <div className="panel">
            <div className="panel-head"><span className="pill">하객</span><span className="muted">{shortUrl(guestUrl)}</span></div>
            {qr && <img className="qr" src={qr} alt={`${w.couple_names} 하객 업로드 QR`} />}
            <div className="row two">
              {qr && <SaveImageButton dataUrl={qr} filename={`tikcx-${w.slug}-qr.png`} />}
              <button className="btn ghost small" type="button" onClick={() => copy(withSource(guestUrl, "invite"), "guest")}>{copied === "guest" ? "복사됨" : "링크 복사"}</button>
            </div>
          </div>

          <div className="panel">
            <div className="panel-head"><span className="pill">대기실 화면</span><span className="muted">모니터에 띄우는 실시간 사진 화면</span></div>
            <p className="muted">노트북이나 아이패드에서 이 화면을 열고 전체 화면으로 띄우세요. 올라오는 사진이 바로 넘어가요.</p>
            <div className="row two">
              <a className="btn small" href={`/w/${w.slug}/live`} target="_blank" rel="noopener">화면 열기</a>
              <button className="btn ghost small" type="button" onClick={() => copy(`${origin}/w/${w.slug}/live`, "live")}>{copied === "live" ? "복사됨" : "주소 복사"}</button>
            </div>
          </div>

          <div className="panel">
            <div className="panel-head"><span className="pill">어디서 들어왔나</span><span className="muted">방문 → 올린 사람</span></div>
            {w.visitors === 0 ? <p className="muted">아직 방문이 없어요.</p> : (
              <table className="src-table">
                <tbody>
                  {SOURCES.filter((s) => (w.visit_sources[s.id] ?? 0) > 0 || (w.upload_sources[s.id] ?? 0) > 0).map((s) => {
                    const v = w.visit_sources[s.id] ?? 0, u = w.upload_sources[s.id] ?? 0;
                    return <tr key={s.id}><th>{s.label}</th><td>{v}명</td><td>{u}명</td><td>{v ? `${Math.min(100, Math.round((u / v) * 100))}%` : "-"}</td></tr>;
                  })}
                </tbody>
              </table>
            )}
          </div>

          <div className="panel">
            <div className="panel-head"><span className="pill">테이블 카드</span><span className="muted">인쇄용</span></div>
            <TableCard url={withSource(guestUrl, "card")} slug={w.slug} names={w.couple_names} date={w.wedding_date} venue={w.venue} />
          </div>

          <button className="btn ghost small danger" type="button" onClick={remove} disabled={deleting}>
            {deleting ? "삭제하는 중…" : armed ? "한 번 더 누르면 사진까지 모두 지워져요" : "이 예식 삭제"}
          </button>
          {delError && <p className="err">{delError}</p>}
        </>
      )}
    </div>
  );

  async function remove() {
    if (!armed) { setArmed(true); setTimeout(() => setArmed(false), 4000); return; }
    setDeleting(true); setDelError("");
    const r = await fetch("/api/admin/weddings", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ key: adminKey, id: w.id }) });
    setDeleting(false); setArmed(false);
    if (r.ok) onDeleted(); else setDelError((await r.json().catch(() => ({}))).error || "삭제하지 못했어요.");
  }
}
