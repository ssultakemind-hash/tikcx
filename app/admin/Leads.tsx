"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { STATUSES, TIMINGS } from "@/lib/leads";
import { useCopy } from "@/lib/copy";

type Lead = { id: string; name: string; phone: string; timing: string; interests: string[]; marketing: boolean; status: string; memo: string | null; wedding_label: string | null; created_at: string };

function saveCsv(rows: Lead[]) {
  const head = ["남긴 날", "이름", "휴대폰", "결혼 예정", "관심", "혜택 수신 동의", "상태", "메모", "어느 예식에서"];
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const body = rows.map((l) => [
    l.created_at.slice(0, 10), l.name, l.phone, l.timing, l.interests.join(" / "), l.marketing ? "동의" : "",
    STATUSES.find((s) => s.id === l.status)?.label ?? l.status, l.memo ?? "", l.wedding_label ?? "",
  ].map((v) => esc(String(v))).join(","));
  const blob = new Blob(["﻿" + [head.map(esc).join(","), ...body].join("\n")], { type: "text/csv;charset=utf-8" });
  const name = `tikcx-예비부부-${new Date().toISOString().slice(0, 10)}.csv`;
  const file = new File([blob], name, { type: "text/csv" });
  const mobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  if (mobile && navigator.canShare?.({ files: [file] })) { navigator.share({ files: [file] }).catch(() => {}); return; }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
}

// Studio admin: people who said "결혼 준비 중이에요" on a guest page.
export default function Leads({ adminKey }: { adminKey: string }) {
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [filter, setFilter] = useState<string>("active");
  const [armed, setArmed] = useState<string | null>(null);
  const { copied, copy } = useCopy();

  const load = useCallback(async () => {
    const r = await fetch(`/api/leads?key=${encodeURIComponent(adminKey)}`, { cache: "no-store" });
    const d = await r.json().catch(() => ({}));
    setLeads(d.leads ?? []);
  }, [adminKey]);
  useEffect(() => { load(); }, [load]);

  async function patch(id: string, body: Record<string, string>) {
    setLeads((ls) => ls && ls.map((l) => (l.id === id ? { ...l, ...body } : l)));
    await fetch("/api/leads", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ key: adminKey, id, ...body }) });
  }
  async function remove(id: string) {
    if (armed !== id) { setArmed(id); setTimeout(() => setArmed((a) => (a === id ? null : a)), 4000); return; }
    await fetch("/api/leads", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ key: adminKey, id }) });
    setLeads((ls) => ls && ls.filter((l) => l.id !== id));
  }

  const shown = useMemo(() => (leads ?? [])
    .filter((l) => filter === "all" || (filter === "active" ? !["booked", "closed"].includes(l.status) : l.timing === filter))
    .sort((a, b) => TIMINGS.indexOf(a.timing as never) - TIMINGS.indexOf(b.timing as never) || b.created_at.localeCompare(a.created_at)), [leads, filter]);

  const newCount = (leads ?? []).filter((l) => l.status === "new").length;

  return (
    <section className="card">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div>
          <div className="eyebrow">하객 중 결혼 준비 중인 사람</div>
          <h2>예비부부 {leads ? leads.length : ""}{newCount ? ` · 새로 ${newCount}` : ""}</h2>
        </div>
        {leads && leads.length > 0 && <button className="btn ghost small" type="button" onClick={() => saveCsv(shown)}>엑셀로 저장</button>}
      </div>
      <div className="chips" role="group" aria-label="예비부부 필터">
        {[["active", "진행 중"], ...TIMINGS.map((t) => [t, t]), ["all", "전체"]].map(([id, label]) => (
          <button key={id} className="chip" type="button" aria-pressed={filter === id} onClick={() => setFilter(id)}>{label}</button>
        ))}
      </div>
      {!leads ? <p className="muted">불러오는 중…</p> : shown.length === 0 ? (
        <div className="empty">아직 없어요. 하객 페이지 맨 아래 "결혼 준비 중이에요"로 남긴 사람이 여기 모여요.</div>
      ) : (
        <div className="list">
          {shown.map((l) => (
            <div key={l.id} className="lead-row">
              <div className="top">
                <b>{l.name} <span className="tag-mini">{l.timing}</span>{l.marketing && <span className="tag-mini" style={{ marginLeft: 4 }}>혜택 동의</span>}</b>
                <span className="muted">{l.created_at.slice(5, 10).replace("-", "/")}{l.wedding_label ? ` · ${l.wedding_label} 예식` : ""}</span>
              </div>
              <div className="row">
                <button className="btn ghost small" type="button" onClick={() => copy(l.phone, l.id)}>{copied === l.id ? "복사됨" : l.phone}</button>
                <a className="btn ghost small" href={`tel:${l.phone}`}>전화</a>
                <select aria-label={`${l.name} 상태`} value={l.status} onChange={(e) => patch(l.id, { status: e.target.value })}>
                  {STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              </div>
              {l.interests.length > 0 && <p className="muted">관심: {l.interests.join(", ")}</p>}
              <textarea aria-label={`${l.name} 메모`} placeholder="메모 (상담 내용 등)" defaultValue={l.memo ?? ""}
                onBlur={(e) => e.target.value !== (l.memo ?? "") && patch(l.id, { memo: e.target.value })} />
              <button className="btn ghost small danger" type="button" onClick={() => remove(l.id)}>{armed === l.id ? "한 번 더 누르면 삭제" : "삭제 (본인 요청 시)"}</button>
            </div>
          ))}
        </div>
      )}
      <p className="fine">남긴 날로부터 1년이 지나면 자동으로 지워져요. 혜택·이벤트 문자는 '혜택 동의' 표시가 있는 사람에게만 보낼 수 있어요.</p>
    </section>
  );
}
