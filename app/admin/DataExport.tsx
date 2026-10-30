"use client";
import { useState } from "react";
import { saveCsv, today } from "@/lib/csv";
import { sceneLabel, SCENES } from "@/lib/scenes";
import { SOURCES } from "@/lib/sources";
import { STATUSES } from "@/lib/leads";

type Stats = {
  couple_names: string | null; wedding_date: string | null; venue: string | null; status: string;
  visitors: number; guests: number; photos: number; videos: number;
  visit_sources: Record<string, number>; upload_sources: Record<string, number>;
  scenes: Record<string, number>; ai_sorted: number; hand_fixed: number;
};
type Fix = { at: string; wedding_date: string | null; venue: string | null; kind: string | null; ai: string | null; from: string | null; to: string };

// Studio admin: download the long-term records as Excel files to keep on the computer.
export default function DataExport({ adminKey }: { adminKey: string }) {
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");

  async function get<T>(type: string): Promise<T[] | null> {
    const r = await fetch(`/api/admin/export?type=${type}`, { cache: "no-store", headers: { "x-admin-key": adminKey } });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { setMsg(d.error || "받지 못했어요. 잠시 뒤 다시 해주세요."); return null; }
    return d.rows as T[];
  }

  async function run(kind: "stats" | "fixes" | "leads") {
    setBusy(kind); setMsg("");
    try {
      if (kind === "stats") {
        const rows = await get<Stats>("stats"); if (!rows) return;
        saveCsv(`tikcx-weddings-${today()}.csv`,
          ["예식일", "신랑·신부", "예식장", "상태", "방문", "올린 하객", "업로드율", "사진", "영상",
            ...SOURCES.map((s) => `방문:${s.label}`), ...SOURCES.map((s) => `올림:${s.label}`),
            "AI가 정리한 사진", "직접 고친 사진", "AI 정확도", ...SCENES.map((s) => `장면:${s.label}`)],
          rows.map((w) => [
            w.wedding_date, w.couple_names ?? "", w.venue, w.status, w.visitors, w.guests,
            w.visitors ? `${Math.min(100, Math.round((w.guests / w.visitors) * 100))}%` : "", w.photos, w.videos,
            ...SOURCES.map((s) => w.visit_sources?.[s.id] ?? 0), ...SOURCES.map((s) => w.upload_sources?.[s.id] ?? 0),
            w.ai_sorted, w.hand_fixed, w.ai_sorted ? `${Math.round(((w.ai_sorted - w.hand_fixed) / w.ai_sorted) * 100)}%` : "",
            ...SCENES.map((s) => w.scenes?.[s.key] ?? 0),
          ]));
        setMsg(`예식 ${rows.length}건을 저장했어요.`);
      } else if (kind === "fixes") {
        const rows = await get<Fix>("corrections"); if (!rows) return;
        saveCsv(`tikcx-ai-fixes-${today()}.csv`,
          ["고친 날", "예식일", "예식장", "사진/영상", "AI 판단", "고치기 전", "고친 장면"],
          rows.map((c) => [c.at.slice(0, 10), c.wedding_date, c.venue, c.kind === "video" ? "영상" : "사진",
            c.ai ? sceneLabel(c.ai) : "", c.from ? sceneLabel(c.from) : "", sceneLabel(c.to)]));
        setMsg(rows.length ? `고친 기록 ${rows.length}건을 저장했어요.` : "아직 고친 기록이 없어요. (빈 파일로 저장했어요)");
      } else {
        const r = await fetch("/api/leads", { cache: "no-store", headers: { "x-admin-key": adminKey } });
        const d = await r.json().catch(() => ({}));
        const rows = (d.leads ?? []) as { created_at: string; name: string; phone: string; timing: string; interests: string[]; marketing: boolean; status: string; memo: string | null; wedding_label: string | null }[];
        saveCsv(`tikcx-leads-${today()}.csv`,
          ["남긴 날", "이름", "휴대폰", "결혼 예정", "고민 중", "소식 수신 동의", "상태", "메모", "어느 예식에서"],
          rows.map((l) => [l.created_at.slice(0, 10), l.name, l.phone, l.timing, l.interests.join(" / "), l.marketing ? "동의" : "",
            STATUSES.find((s) => s.id === l.status)?.label ?? l.status, l.memo ?? "", l.wedding_label ?? ""]));
        setMsg(`예비부부 ${rows.length}명을 저장했어요.`);
      }
    } finally { setBusy(""); }
  }

  return (
    <section className="card">
      <div>
        <div className="eyebrow">우리 데이터</div>
        <h2>데이터 내보내기</h2>
      </div>
      <p className="muted">사진은 예식 30일 뒤 지워지지만, 아래 기록은 사진 없이 계속 남아요. 한 달에 한 번 PC에서 받아 보관해 두세요.</p>
      <div className="list">
        <button className="btn ghost" type="button" onClick={() => run("stats")} disabled={!!busy}>{busy === "stats" ? "준비 중…" : "예식 통계 (엑셀)"}</button>
        <button className="btn ghost" type="button" onClick={() => run("fixes")} disabled={!!busy}>{busy === "fixes" ? "준비 중…" : "AI 고친 기록 (엑셀)"}</button>
        <button className="btn ghost" type="button" onClick={() => run("leads")} disabled={!!busy}>{busy === "leads" ? "준비 중…" : "예비부부 전체 (엑셀)"}</button>
      </div>
      {msg && <p className="muted">{msg}</p>}
    </section>
  );
}
