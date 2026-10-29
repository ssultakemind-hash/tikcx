"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Invite from "./Invite";
import SaveAll from "./SaveAll";
import CoverPicker from "../../CoverPicker";
import { shortDate, WARN_DAYS, type Phase } from "@/lib/dates";

type Item = { id: string; kind: "image" | "video"; from: string; pro: boolean; at: string; url: string | null; thumb: string | null };
type Data = { wedding: { couple_names: string; wedding_date: string | null; venue: string | null; guest_gallery: boolean }; phase: Phase; cover: string | null; guestCount: number; items: Item[] };
type Filter = "all" | "guest" | "pro" | "video";

function withDownload(url: string) {
  return url + (url.includes("?") ? "&" : "?") + "download=";
}

export default function Gallery({ slug, k, fromAdmin }: { slug: string; k: string; fromAdmin?: boolean }) {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [cur, setCur] = useState<Item | null>(null);
  const [original, setOriginal] = useState(false);
  const [armed, setArmed] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch(`/api/gallery?slug=${encodeURIComponent(slug)}&k=${encodeURIComponent(k)}`, { cache: "no-store" });
    const d = await r.json();
    if (!r.ok) { setError(d.error || "앨범을 불러오지 못했습니다."); return; }
    setData(d);
  }, [slug, k]);

  useEffect(() => { load(); const t = setInterval(load, 60_000); return () => clearInterval(t); }, [load]);

  const list = useMemo(() => (data?.items ?? []).filter((it) =>
    filter === "all" || (filter === "guest" && it.kind === "image") || (filter === "pro" && it.pro) || (filter === "video" && it.kind === "video")), [data, filter]);

  const stats = useMemo(() => {
    const items = data?.items ?? [];
    return {
      photos: items.filter((i) => i.kind === "image").length,
      videos: items.filter((i) => i.kind === "video").length,
      guests: data?.guestCount ?? new Set(items.filter((i) => !i.pro).map((i) => i.from)).size,
    };
  }, [data]);

  const [saving, setSaving] = useState(false);
  async function toggleShare() {
    if (!data || saving) return;
    const next = !data.wedding.guest_gallery;
    setSaving(true);
    const r = await fetch("/api/settings", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ slug, k, guest_gallery: next }) });
    if (r.ok) setData((d) => d && { ...d, wedding: { ...d.wedding, guest_gallery: next } });
    setSaving(false);
  }

  async function remove() {
    if (!cur) return;
    if (!armed) { setArmed(true); setTimeout(() => setArmed(false), 3000); return; }
    const r = await fetch("/api/delete", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ slug, k, id: cur.id }) });
    if (r.ok) setData((d) => d && { ...d, items: d.items.filter((i) => i.id !== cur.id) });
    setCur(null); setArmed(false);
  }

  if (error) return <main className="wrap"><div className="brand"><span className="logo" aria-label="tikcx">tikcx<i>.</i></span></div><div className="card"><h1>앨범을 열 수 없어요</h1><p className="muted">{error} 받으신 신랑·신부 전용 링크를 다시 확인해주세요.</p></div></main>;
  if (!data) return <main className="wrap"><div className="brand"><span className="logo" aria-label="tikcx">tikcx<i>.</i></span></div><div className="card"><p className="muted">앨범을 불러오는 중…</p></div></main>;

  const filters: [Filter, string][] = [["all", "전체"], ["guest", "사진"], ["video", "영상"]];

  return (
    <main className="wrap">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div className="brand"><span className="logo" aria-label="tikcx">tikcx<i>.</i></span><small>소중한 순간들을 한곳에</small></div>
        {fromAdmin && <a className="btn ghost small" href="/admin">← 관리자</a>}
      </div>
      {data.phase.daysLeft !== null && data.phase.daysLeft <= WARN_DAYS && data.phase.daysLeft > 0 && data.items.length > 0 && (
        <section className="card warn">
          <h2>{data.phase.daysLeft}일 뒤 사진이 삭제돼요</h2>
          <p>{shortDate(data.phase.deleteOn)}에 모든 사진과 영상이 지워져요. 아래 <b>전체 저장</b>으로 지금 저장해 두세요.</p>
        </section>
      )}
      {data.phase.expired && (
        <section className="card warn">
          <h2>보관 기간이 끝났어요</h2>
          <p>예식 후 30일이 지나 사진과 영상이 삭제됐어요.</p>
        </section>
      )}
      {!data.phase.expired && <Invite slug={slug} names={data.wedding.couple_names} defaultOpen={data.items.length === 0} />}
      <section className="card setting">
        <div style={{ minWidth: 0 }}>
          <h2>하객에게 사진 공개</h2>
          <p className="muted">{data.wedding.guest_gallery
            ? "하객분들도 서로 올린 사진을 미리보기로 볼 수 있어요. 원본 저장과 삭제는 두 분만 가능해요."
            : "지금은 두 분만 사진을 볼 수 있어요. 하객분들은 자기가 올린 사진만 볼 수 있어요."}</p>
        </div>
        <button type="button" role="switch" aria-checked={data.wedding.guest_gallery} aria-label="하객에게 사진 공개"
          className="switch" onClick={toggleShare} disabled={saving}><i /></button>
      </section>
      {!data.phase.expired && (
        <section className="card">
          <div>
            <h2>대표 사진</h2>
            <p className="muted">하객 페이지 맨 위에 크게 보여요. 두 분이 좋아하는 사진으로 바꿀 수 있어요.</p>
          </div>
          <CoverPicker slug={slug} auth={{ k }} initialUrl={data.cover}
            onChange={(url) => setData((d) => d && { ...d, cover: url })} />
        </section>
      )}
      <section className="card">
        {data.cover && (
          <div className="hero photo" style={{ backgroundImage: `url("${data.cover}")`, aspectRatio: "16 / 10" }}>
            <div><div className="names">{data.wedding.couple_names}</div></div>
          </div>
        )}
        <div>
          <div className="eyebrow">{data.wedding.couple_names} · 신랑·신부 전용</div>
          <h1>오늘의 순간들</h1>
        </div>
        <div className="stats">
          <div className="stat"><b>{stats.photos}</b><span>사진</span></div>
          <div className="stat"><b>{stats.videos}</b><span>영상</span></div>
          <div className="stat"><b>{stats.guests}</b><span>보낸 하객</span></div>
        </div>
        <SaveAll slug={slug} items={data.items} />
        <div className="chips" role="group" aria-label="보기 필터">
          {filters.map(([f, label]) => (
            <button key={f} className="chip" type="button" aria-pressed={filter === f} onClick={() => setFilter(f)}>{label}</button>
          ))}
        </div>
        {list.length === 0 ? (
          <div className="empty">아직 올라온 사진이 없어요.<br />하객분들이 QR로 올리면 여기에 바로 모입니다.</div>
        ) : (
          <div className="grid">
            {list.map((it) => (
              <button key={it.id} className="tile" type="button" aria-label={`${it.from}의 ${it.kind === "video" ? "영상" : "사진"} 크게 보기`}
                onClick={() => { setCur(it); setOriginal(false); }}>
                {it.thumb ? <img src={it.thumb} alt="" loading="lazy" />
                  : it.kind === "video" ? <video src={it.url ?? undefined} muted preload="metadata" playsInline />
                  : <img src={it.url ?? undefined} alt="" loading="lazy" />}
                <span className="tag">{it.from}</span>
                {it.kind === "video" && <span className="play">▶ 영상</span>}
              </button>
            ))}
          </div>
        )}
        {data.phase.deleteOn && (
          <p className="muted">하객 업로드 {shortDate(data.phase.uploadUntil)}까지 · 앨범 보관 {shortDate(data.phase.deleteOn)}까지</p>
        )}
      </section>

      {cur && (
        <div className="viewer" role="dialog" aria-modal="true" aria-label="크게 보기">
          <button className="close" type="button" onClick={() => setCur(null)}>닫기 ✕</button>
          <div className="stage">
            {cur.kind === "video"
              ? <video src={cur.url ?? undefined} controls playsInline />
              : original ? <img src={cur.url ?? undefined} alt="" /> : <Watermarked src={cur.url ?? ""} />}
          </div>
          <p className="vinfo">{cur.from} · {cur.kind === "video" ? "영상" : original ? "원본 화질" : "무료 보기: 720p + 워터마크"}</p>
          {cur.kind === "image" && (
            <div className="row">
              <button className="btn vbtn" type="button" onClick={() => setOriginal(false)}>무료 보기</button>
              <button className="btn vbtn solid" type="button" onClick={() => setOriginal(true)}>원본 보기</button>
            </div>
          )}
          <div className="row">
            {cur.url && <a className="btn vbtn" href={withDownload(cur.url)}>원본 저장</a>}
            <button className="btn vbtn danger" type="button" onClick={remove}>{armed ? "한 번 더 누르면 삭제됩니다" : "삭제"}</button>
          </div>
        </div>
      )}
    </main>
  );
}

function Watermarked({ src }: { src: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      const c = ref.current; if (!c) return;
      const s = Math.min(1, 720 / img.naturalWidth);
      c.width = Math.round(img.naturalWidth * s); c.height = Math.round(img.naturalHeight * s);
      const x = c.getContext("2d")!;
      x.drawImage(img, 0, 0, c.width, c.height);
      x.save(); x.translate(c.width / 2, c.height / 2); x.rotate(-Math.PI / 7);
      x.fillStyle = "rgba(255,255,255,.38)"; x.font = `700 ${Math.round(c.width / 9)}px sans-serif`; x.textAlign = "center";
      for (let y = -c.height; y < c.height; y += c.width / 4) x.fillText("tikcx", 0, y);
      x.restore();
    };
    img.src = src;
  }, [src]);
  return <canvas ref={ref} />;
}
