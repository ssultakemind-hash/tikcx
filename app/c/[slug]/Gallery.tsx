"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Invite from "./Invite";
import SaveAll from "./SaveAll";
import CoverPicker from "../../CoverPicker";
import { shortDate, WARN_DAYS, type Phase } from "@/lib/dates";
import { SCENES, sceneLabel } from "@/lib/scenes";

type Item = { id: string; kind: "image" | "video"; from: string; pro: boolean; at: string; url: string | null; thumb: string | null; scene: string | null; canScene: boolean };
type Data = { wedding: { couple_names: string; wedding_date: string | null; venue: string | null; guest_gallery: boolean }; phase: Phase; cover: string | null; guestCount: number; ai: boolean; items: Item[] };
type Filter = "all" | "guest" | "pro" | "video";

function withDownload(url: string) {
  return url + (url.includes("?") ? "&" : "?") + "download=";
}

export default function Gallery({ slug, k, fromAdmin }: { slug: string; k: string; fromAdmin?: boolean }) {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [cur, setCur] = useState<Item | null>(null);
  const [armed, setArmed] = useState(false);
  const [scene, setScene] = useState<string | null>(null);
  const [sorting, setSorting] = useState<{ done: number; total: number } | null>(null);
  const [sortError, setSortError] = useState("");

  const load = useCallback(async () => {
    const r = await fetch(`/api/gallery?slug=${encodeURIComponent(slug)}&k=${encodeURIComponent(k)}`, { cache: "no-store" });
    const d = await r.json();
    if (!r.ok) { setError(d.error || "앨범을 불러오지 못했습니다."); return; }
    setData(d);
  }, [slug, k]);

  useEffect(() => { load(); const t = setInterval(load, 60_000); return () => clearInterval(t); }, [load]);

  const list = useMemo(() => (data?.items ?? []).filter((it) =>
    (filter === "all" || (filter === "guest" && it.kind === "image") || (filter === "pro" && it.pro) || (filter === "video" && it.kind === "video"))
    && (!scene || it.scene === scene)), [data, filter, scene]);

  const sceneCounts = useMemo(() => {
    const c = new Map<string, number>();
    (data?.items ?? []).forEach((i) => i.scene && c.set(i.scene, (c.get(i.scene) ?? 0) + 1));
    return SCENES.filter((s) => c.has(s.key)).map((s) => ({ ...s, n: c.get(s.key)! }));
  }, [data]);
  const unsorted = (data?.items ?? []).filter((i) => i.canScene && !i.scene).length;

  // Asks the AI to sort photos into scenes, one batch per call, until none are left.
  async function sortScenes(reset = false) {
    if (sorting) return;
    setSortError("");
    const total = (data?.items ?? []).filter((i) => i.canScene).length;
    setSorting({ done: reset ? 0 : total - unsorted, total });
    if (reset) setScene(null);
    let first = true;
    for (let guard = 0; guard < 300; guard++) {
      const r = await fetch("/api/scenes", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ slug, k, reset: reset && first }) });
      first = false;
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setSortError((d.error || "장면 정리를 하지 못했어요.") + (d.detail ? ` (원인: ${d.detail.slice(0, 120)})` : "")); break; }
      setData((cur) => cur && { ...cur, items: cur.items.map((i) => ({ ...i, scene: d.scenes?.[i.id] ?? null })) });
      setSorting({ done: d.done, total: d.done + d.left });
      if (!d.left) break;
    }
    setSorting(null);
  }

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

  // Phone: share sheet so "이미지 저장 / 비디오 저장" puts it straight into Photos.
  // Computer (or a phone without sharing): downloads the file without leaving the album.
  const [busySave, setBusySave] = useState(false);
  async function saveCurrent() {
    if (!cur?.url || busySave) return;
    const mobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    setBusySave(true);
    try {
      const blob = await fetch(cur.url).then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.blob(); });
      const ext = cur.kind === "video" ? (blob.type.includes("quicktime") ? "mov" : "mp4") : (blob.type.includes("png") ? "png" : blob.type.includes("heic") ? "heic" : "jpg");
      const name = `tikcx-${cur.id.slice(0, 8)}.${ext}`;
      const file = new File([blob], name, { type: blob.type });
      if (mobile && navigator.canShare?.({ files: [file] })) {
        try { await navigator.share({ files: [file] }); return; }
        catch (e) { if ((e as Error)?.name === "AbortError") return; }
      }
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href; a.download = name;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(href), 60_000);
    } catch {
      window.open(withDownload(cur.url), "_blank");
    } finally {
      setBusySave(false);
    }
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

  const settingsBlock = (
    <>
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
    </>
  );
  const photosBlock = (
    <>
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
        <div className="chips" role="group" aria-label="보기 필터">
          {filters.map(([f, label]) => (
            <button key={f} className="chip" type="button" aria-pressed={filter === f} onClick={() => setFilter(f)}>{label}</button>
          ))}
        </div>
        {data.items.length > 0 && !data.ai && <p className="muted">AI 장면 정리는 준비 중이에요.</p>}
        {data.items.length > 0 && data.ai && sceneCounts.length === 0 && unsorted === 0 && (
          <p className="muted">AI 장면 정리: 미리보기가 없는 사진({data.items.length}장)이라 정리할 수 없어요.</p>
        )}
        {data.ai && (sceneCounts.length > 0 || unsorted > 0) && (
          <div className="scenes">
            {sceneCounts.length > 0 && (
              <div className="chips wrapchips" role="group" aria-label="장면별 보기">
                <button className="chip" type="button" aria-pressed={!scene} onClick={() => setScene(null)}>모든 장면</button>
                {sceneCounts.map((s) => (
                  <button key={s.key} className="chip" type="button" aria-pressed={scene === s.key} onClick={() => setScene(scene === s.key ? null : s.key)}>
                    {s.label} <small>{s.n}</small>
                  </button>
                ))}
              </div>
            )}
            {unsorted > 0 && (
              <button className="btn ghost small" type="button" onClick={() => sortScenes()} disabled={!!sorting}>
                {sorting ? `AI가 장면을 정리하는 중… ${sorting.done}/${sorting.total}` : sceneCounts.length ? `새 사진 ${unsorted}장 장면 정리하기` : `AI로 장면별 정리하기 (${unsorted}장)`}
              </button>
            )}
            {unsorted === 0 && sceneCounts.length > 0 && (
              <button className="btn ghost small" type="button" onClick={() => sortScenes(true)} disabled={!!sorting}>
                {sorting ? `AI가 장면을 다시 정리하는 중… ${sorting.done}/${sorting.total}` : "장면 다시 정리하기"}
              </button>
            )}
            {sortError && <p className="notice">{sortError}</p>}
          </div>
        )}
        {list.length > 0 && (
          <SaveAll key={`${filter}-${scene}`} slug={slug} items={list}
            label={[scene ? sceneLabel(scene) : "", filter === "guest" ? "사진" : filter === "video" ? "영상" : ""].filter(Boolean).join(" ") || undefined}
            fileTag={[scene ?? "", filter === "guest" ? "photo" : filter === "video" ? "video" : ""].filter(Boolean).join("-")}
            albumUrl={typeof window !== "undefined" ? window.location.href.replace(/&from=admin/, "") : undefined} />
        )}
        {list.length === 0 ? (
          <div className="empty">아직 올라온 사진이 없어요.<br />하객분들이 QR로 올리면 여기에 바로 모입니다.</div>
        ) : (
          <div className="grid">
            {list.map((it) => (
              <button key={it.id} className="tile" type="button" aria-label={`${it.from}의 ${it.kind === "video" ? "영상" : "사진"} 크게 보기`}
                onClick={() => setCur(it)}>
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
      <section className="card soon">
        <div className="soon-head"><span className="pill">준비 중</span><span className="eyebrow">AI 하이라이트</span></div>
        <h2>오늘의 장면들이 1분 영상으로</h2>
        <p className="muted">하객분들이 보내준 사진과 영상 중 가장 좋은 순간만 골라 입장부터 행진까지 한 편의 영상으로 만들어 드릴 예정이에요.</p>
      </section>
    </>
  );

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
      {/* Before photos arrive: inviting guests comes first. After: the photos come first. */}
      {data.items.length === 0 ? <>{settingsBlock}{photosBlock}</> : <>{photosBlock}{settingsBlock}</>}
      {cur && (
        <div className="viewer" role="dialog" aria-modal="true" aria-label="크게 보기">
          <button className="close" type="button" onClick={() => setCur(null)}>닫기 ✕</button>
          <div className="stage">
            {cur.kind === "video"
              ? <video src={cur.url ?? undefined} controls playsInline />
              : <img src={cur.url ?? undefined} alt="" />}
          </div>
          <p className="vinfo">{cur.from} · {cur.kind === "video" ? "영상" : "사진"} · 원본 화질</p>
          <div className="row">
            <button className="btn vbtn solid" type="button" onClick={saveCurrent} disabled={busySave}>{busySave ? "준비 중…" : "저장"}</button>
            <button className="btn vbtn danger" type="button" onClick={remove}>{armed ? "한 번 더 누르면 삭제" : "삭제"}</button>
          </div>
        </div>
      )}
    </main>
  );
}
