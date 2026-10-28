"use client";
import { useEffect, useState } from "react";

type Item = { id: string; kind: "image" | "video"; from: string; thumb: string };

// "모두의 사진": every guest's photos as small previews. View only.
export default function Wall({ slug, refresh }: { slug: string; refresh: number }) {
  const [items, setItems] = useState<Item[] | null>(null);
  const [open, setOpen] = useState<Item | null>(null);

  useEffect(() => {
    let alive = true;
    const load = () => fetch(`/api/wall?slug=${encodeURIComponent(slug)}`, { cache: "no-store" })
      .then((r) => r.json()).then((d) => alive && setItems(d.enabled ? d.items : null)).catch(() => {});
    load();
    const t = setInterval(load, 30_000);
    return () => { alive = false; clearInterval(t); };
  }, [slug, refresh]);

  if (!items) return null;

  return (
    <section className="card">
      <div>
        <div className="eyebrow">하객들이 올린 순간</div>
        <h2>모두의 사진 {items.length > 0 ? items.length : ""}</h2>
      </div>
      {items.length === 0 ? (
        <div className="empty">아직 올라온 사진이 없어요.<br />첫 번째 사진을 올려주세요.</div>
      ) : (
        <div className="grid">
          {items.map((it) => (
            <button key={it.id} className="tile" type="button" aria-label={`${it.from}의 ${it.kind === "video" ? "영상" : "사진"} 크게 보기`} onClick={() => setOpen(it)}>
              <img src={it.thumb} alt="" loading="lazy" />
              <span className="tag">{it.from}</span>
              {it.kind === "video" && <span className="play">▶ 영상</span>}
            </button>
          ))}
        </div>
      )}
      <p className="muted">미리보기만 볼 수 있어요. 원본은 두 사람에게만 전해져요.</p>

      {open && (
        <div className="viewer" role="dialog" aria-modal="true" aria-label="크게 보기">
          <button className="close" type="button" onClick={() => setOpen(null)}>닫기</button>
          <div className="stage"><img src={open.thumb} alt="" /></div>
          <p className="vinfo">{open.from}</p>
        </div>
      )}
    </section>
  );
}
