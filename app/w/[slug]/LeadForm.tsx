"use client";
import { useEffect, useState } from "react";
import { INTERESTS, TIMINGS } from "@/lib/leads";
import { deviceId } from "@/lib/upload";

// "결혼 준비 중이세요?" — a guest who is getting married can leave their contact.
export default function LeadForm({ slug }: { slug: string }) {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [timing, setTiming] = useState("");
  const [interests, setInterests] = useState<string[]>([]);
  const [consent, setConsent] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { try { if (localStorage.getItem("tikcx_lead_sent")) setDone(true); } catch {} }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError("");
    const r = await fetch("/api/leads", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ slug, name, phone, timing, interests, consent, marketing, deviceId: deviceId() }),
    });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setError(d.error || "저장하지 못했어요."); return; }
    try { localStorage.setItem("tikcx_lead_sent", "1"); } catch {}
    setDone(true);
  }

  const toggle = (i: string) => setInterests((xs) => (xs.includes(i) ? xs.filter((x) => x !== i) : [...xs, i]));

  if (done) {
    return (
      <section className="card lead">
        <h2>고마워요. 곧 연락드릴게요</h2>
        <p className="muted">TAKEMIND에서 남겨주신 번호로 연락드려요. 결혼 준비 응원할게요.</p>
      </section>
    );
  }

  if (!open) {
    return (
      <section className="card lead">
        <div>
          <div className="eyebrow">곧 결혼하세요?</div>
          <h2>두 분의 날도 틱스와 함께해요</h2>
        </div>
        <p className="muted">결혼 준비 중이라면 연락처를 남겨주세요. 틱스를 무료로 열어드리고, TAKEMIND 예비부부 혜택도 보내드려요.</p>
        <button className="btn" type="button" onClick={() => setOpen(true)}>결혼 준비 중이에요</button>
      </section>
    );
  }

  return (
    <form className="card lead" onSubmit={submit}>
      <div>
        <div className="eyebrow">곧 결혼하세요?</div>
        <h2>연락처를 남겨주세요</h2>
      </div>
      <div className="field"><label htmlFor="lead-name">이름</label>
        <input id="lead-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={30} autoComplete="name" required /></div>
      <div className="field"><label htmlFor="lead-phone">휴대폰 번호</label>
        <input id="lead-phone" value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="010-0000-0000" autoComplete="tel" required /></div>
      <fieldset className="field plain">
        <legend>결혼 예정 시기</legend>
        <div className="chips">
          {TIMINGS.map((t) => (
            <button key={t} type="button" className="chip" aria-pressed={timing === t} onClick={() => setTiming(t)}>{t}</button>
          ))}
        </div>
      </fieldset>
      <fieldset className="field plain">
        <legend>관심 있는 것 (선택)</legend>
        <div className="chips">
          {INTERESTS.map((t) => (
            <button key={t} type="button" className="chip" aria-pressed={interests.includes(t)} onClick={() => toggle(t)}>{t}</button>
          ))}
        </div>
      </fieldset>
      <label className="check">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
        <span><b>[필수]</b> 개인정보 수집·이용 동의<br />
          <small>이름, 휴대폰 번호, 결혼 예정 시기, 관심 항목을 TAKEMIND가 상담 연락에 써요. 1년 보관 후 지우고, 언제든 삭제를 요청할 수 있어요.</small></span>
      </label>
      <label className="check">
        <input type="checkbox" checked={marketing} onChange={(e) => setMarketing(e.target.checked)} />
        <span>[선택] 혜택·이벤트 소식 받기<br />
          <small>TAKEMIND 예비부부 혜택을 문자나 카카오톡으로 받아요. 언제든 그만 받을 수 있어요.</small></span>
      </label>
      {error && <p className="err">{error}</p>}
      <button className="btn" type="submit" disabled={busy || !consent || !timing}>{busy ? "보내는 중…" : "남기기"}</button>
      <button className="btn ghost small" type="button" onClick={() => setOpen(false)}>닫기</button>
    </form>
  );
}
