"use client";
import { useEffect, useState } from "react";
import { useStableUrls } from "@/lib/stableUrls";
import { MOODS, SCENES } from "@/lib/scenes";

type Item = { id: string; kind: "image" | "video"; from: string; thumb: string | null; scene?: string | null; mood?: string | null };

// "모두의 사진": every guest's photos as small previews. View only.
export default function Wall({ slug, refresh }: { slug: string; refresh: number }) {
  const [items, setItems] = useState<Item[] | null>(null);
  const [open, setOpen] = useState<Item | null>(null);
  const stable = useStableUrls();
  const [scene, setScene] = useState<string | null>(null);
  const [mood, setMood] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const load = () => fetch(`/api/wall?slug=${encodeURIComponent(slug)}`, { cache: "no-store" })
      .then((r) => r.json()).then((d) => alive && setItems(d.enabled ? stable(d.items as Item[]) : null)).catch(() => {});
    load();
    const t = setInterval(load, 30_000);
    return () => { alive = false; clearInterval(t); };
  }, [slug, refresh]);

  if (!items) return null;
  const counts = new Map<string, number>();
  items.forEach((i) => i.scene && counts.set(i.scene, (counts.get(i.scene) ?? 0) + 1));
  const sceneChips = SCENES.filter((s) => counts.has(s.key));
  const mc = new Map<string, number>();
  items.forEach((i) => i.mood && mc.set(i.mood, (mc.get(i.mood) ?? 0) + 1));
  const moodChips = MOODS.filter((m) => mc.has(m.key));
  const shown = items.filter((i) => (!scene || i.scene === scene) && (!mood || i.mood === mood));

  return (
    <section className="card">
      <div>
        <div className="eyebrow">하객들이 올린 순간</div>
        <h2>모두의 사진·영상 {items.length > 0 ? items.length : ""}</h2>
      </div>
      {items.length === 0 ? (
        <div className="empty">아직 올라온 사진이 없어요.<br />첫 번째 사진을 올려주세요.</div>
      ) : (
        <>
        {sceneChips.length > 0 && (
          <div className="chips wrapchips" role="group" aria-label="장면별 보기">
            <button className="chip" type="button" aria-pressed={!scene} onClick={() => setScene(null)}>모든 장면</button>
            {sceneChips.map((s) => (
              <button key={s.key} className="chip" type="button" aria-pressed={scene === s.key} onClick={() => setScene(scene === s.key ? null : s.key)}>
                {s.label} <small>{counts.get(s.key)}</small>
              </button>
            ))}
          </div>
        )}
        {moodChips.length > 0 && (
          <div className="chips wrapchips" role="group" aria-label="감정별 보기">
            <span className="chip-label">감정</span>
            {moodChips.map((m) => (
              <button key={m.key} className="chip" type="button" aria-pressed={mood === m.key} onClick={() => setMood(mood === m.key ? null : m.key)}>
                {m.label} <small>{mc.get(m.key)}</small>
              </button>
            ))}
          </div>
        )}
        <div className="grid">
          {shown.map((it) => (
            <button key={it.id} className="tile" type="button" aria-label={`${it.from}의 ${it.kind === "video" ? "영상" : "사진"} 크게 보기`} onClick={() => setOpen(it)}>
              {it.thumb ? <img src={it.thumb} alt="" loading="lazy" /> : <span className="video-tile" aria-hidden="true">▶</span>}
              <span className="tag">{it.from}</span>
              {it.kind === "video" && <span className="play">▶ 영상</span>}
            </button>
          ))}
        </div>
        </>
      )}
      <p className="muted">미리보기만 볼 수 있어요. 원본은 두 사람에게만 전해져요.</p>

      {open && (
        <div className="viewer" role="dialog" aria-modal="true" aria-label="크게 보기">
          <button className="close" type="button" onClick={() => setOpen(null)}>닫기</button>
          <div className="stage">{open.thumb ? <img src={open.thumb} alt="" /> : <span className="video-tile big" aria-hidden="true">▶</span>}</div>
          <p className="vinfo">{open.from}{open.kind === "video" ? " · 영상은 두 사람의 앨범에서 재생돼요" : ""}</p>
        </div>
      )}
    </section>
  );
}
