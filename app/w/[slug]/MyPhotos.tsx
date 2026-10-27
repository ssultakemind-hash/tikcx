"use client";
import { useEffect, useState } from "react";
import { getMine } from "@/lib/upload";

type Item = { id: string; kind: "image" | "video"; url: string | null; thumb: string | null };

// "내가 올린 사진": only what this phone uploaded.
export default function MyPhotos({ slug, refresh }: { slug: string; refresh: number }) {
  const [items, setItems] = useState<Item[]>([]);
  const [open, setOpen] = useState<Item | null>(null);

  useEffect(() => {
    const ids = getMine(slug);
    if (!ids.length) return;
    fetch("/api/mine", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ slug, ids }) })
      .then((r) => r.json()).then((d) => setItems(d.items ?? [])).catch(() => {});
  }, [slug, refresh]);

  if (!items.length) return null;

  return (
    <section className="card">
      <div>
        <div className="eyebrow">이 휴대폰에서 올린 사진</div>
        <h2>내가 올린 사진 {items.length}</h2>
      </div>
      <div className="grid">
        {items.map((it) => (
          <button key={it.id} className="tile" type="button" aria-label={it.kind === "video" ? "영상 크게 보기" : "사진 크게 보기"} onClick={() => setOpen(it)}>
            {it.thumb ? <img src={it.thumb} alt="" loading="lazy" />
              : it.kind === "video" ? <video src={it.url ?? undefined} muted preload="metadata" playsInline />
              : <img src={it.url ?? undefined} alt="" loading="lazy" />}
            {it.kind === "video" && <span className="play">▶ 영상</span>}
          </button>
        ))}
      </div>
      <p className="muted">다른 하객의 사진은 두 사람만 볼 수 있어요.</p>

      {open && (
        <div className="viewer" role="dialog" aria-modal="true" aria-label="크게 보기">
          <button className="close" type="button" onClick={() => setOpen(null)}>닫기</button>
          <div className="stage">
            {open.kind === "video" ? <video src={open.url ?? undefined} controls playsInline /> : <img src={open.url ?? undefined} alt="" />}
          </div>
        </div>
      )}
    </section>
  );
}
