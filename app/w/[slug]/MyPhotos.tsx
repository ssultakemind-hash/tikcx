"use client";
import { useEffect, useState } from "react";
import { deviceId, getMine, removeMine } from "@/lib/upload";

type Item = { id: string; kind: "image" | "video"; url: string | null; thumb: string | null };

// "내가 올린 사진": only what this phone uploaded.
export default function MyPhotos({ slug, refresh }: { slug: string; refresh: number }) {
  const [items, setItems] = useState<Item[]>([]);
  const [open, setOpen] = useState<Item | null>(null);
  const [armed, setArmed] = useState(false);
  const [err, setErr] = useState("");

  async function remove() {
    if (!open) return;
    if (!armed) { setArmed(true); setTimeout(() => setArmed(false), 3000); return; }
    const r = await fetch("/api/delete-mine", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ slug, id: open.id, deviceId: deviceId() }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { setErr(d.error || "지우지 못했어요."); return; }
    removeMine(slug, open.id);
    setItems((list) => list.filter((i) => i.id !== open.id));
    setOpen(null); setArmed(false); setErr("");
  }

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
              : it.kind === "video" ? <video src={it.url ? it.url + "#t=0.1" : undefined} muted preload="metadata" playsInline />
              : <img src={it.url ?? undefined} alt="" loading="lazy" />}
            {it.kind === "video" && <span className="play">▶ 영상</span>}
          </button>
        ))}
      </div>
      <p className="muted">잘못 올린 사진은 눌러서 지울 수 있어요.</p>

      {open && (
        <div className="viewer" role="dialog" aria-modal="true" aria-label="크게 보기">
          <button className="close" type="button" onClick={() => { setOpen(null); setArmed(false); setErr(""); }}>닫기 ✕</button>
          <div className="stage">
            {open.kind === "video" ? <video src={open.url ?? undefined} controls playsInline /> : <img src={open.url ?? undefined} alt="" />}
          </div>
          {err && <p className="vinfo">{err}</p>}
          <div className="row">
            <button className="btn vbtn danger" type="button" onClick={remove}>{armed ? "한 번 더 누르면 지워져요" : "이 사진 지우기"}</button>
          </div>
        </div>
      )}
    </section>
  );
}
