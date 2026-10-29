"use client";
import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { withSource } from "@/lib/sources";

type Item = { id: string; kind: "image" | "video"; from: string; thumb: string };

const SLIDE_MS = 6000;
const REFRESH_MS = 10000;

export default function LiveScreen({ slug, names }: { slug: string; names: string }) {
  const [items, setItems] = useState<Item[]>([]);
  const [enabled, setEnabled] = useState(true);
  const [idx, setIdx] = useState(0);
  const [qr, setQr] = useState("");
  const [fresh, setFresh] = useState<string | null>(null); // id of a just-arrived photo
  const seen = useRef<Set<string>>(new Set());
  const first = useRef(true);

  useEffect(() => {
    const url = withSource(`${location.origin}/w/${slug}`, "screen");
    QRCode.toDataURL(url, { width: 900, margin: 1, color: { dark: "#0A0A0A", light: "#FFFFFF" } }).then(setQr).catch(() => {});
  }, [slug]);

  // Poll for photos; jump to a newly arrived one so the guest sees it right away.
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const d = await fetch(`/api/wall?slug=${encodeURIComponent(slug)}`, { cache: "no-store" }).then((r) => r.json());
        if (!alive) return;
        setEnabled(!!d.enabled);
        const list: Item[] = (d.items ?? []).filter((i: Item) => i.kind === "image");
        const newcomer = list.find((i) => !seen.current.has(i.id));
        list.forEach((i) => seen.current.add(i.id));
        setItems(list);
        if (newcomer && !first.current) { setIdx(list.findIndex((i) => i.id === newcomer.id)); setFresh(newcomer.id); }
        first.current = false;
      } catch { /* keep showing what we have */ }
    };
    load();
    const t = setInterval(load, REFRESH_MS);
    return () => { alive = false; clearInterval(t); };
  }, [slug]);

  useEffect(() => {
    if (items.length < 2) return;
    const t = setTimeout(() => { setIdx((i) => (i + 1) % items.length); setFresh(null); }, fresh ? SLIDE_MS * 1.5 : SLIDE_MS);
    return () => clearTimeout(t);
  }, [idx, items.length, fresh]);

  // Keep the screen awake where the browser allows it.
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null;
    const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } };
    nav.wakeLock?.request("screen").then((l) => { lock = l; }).catch(() => {});
    return () => { lock?.release().catch(() => {}); };
  }, []);

  const cur = items[idx % Math.max(items.length, 1)];
  const showPhotos = enabled && items.length > 0;

  return (
    <div className="live">
      <div className="live-stage">
        {showPhotos ? (
          items.map((it, i) => (
            <div key={it.id} className={`live-slide${i === idx ? " on" : ""}`} aria-hidden={i !== idx}>
              <img className="live-bg" src={it.thumb} alt="" />
              <img className="live-photo" src={it.thumb} alt={`${it.from}이 올린 사진`} />
            </div>
          ))
        ) : (
          <div className="live-empty">
            <p className="live-names">{names}</p>
            <p className="live-big">{enabled ? "첫 번째 사진을\n올려주세요" : "오늘 찍은 사진을\n두 사람에게 보내주세요"}</p>
          </div>
        )}
        {showPhotos && cur && (
          <div className="live-caption">
            {fresh === cur.id && <span className="live-new">방금 올라온 사진</span>}
            <span>{cur.from}</span>
          </div>
        )}
      </div>
      <aside className="live-side">
        <div className="logo live-logo">tikcx<i>.</i></div>
        <div>
          <p className="live-title">찍은 사진,<br />지금 올려주세요</p>
          <p className="live-sub">{enabled ? "올리면 바로 이 화면에 나와요" : "원본 그대로 두 사람에게 전해져요"}</p>
        </div>
        {qr && <img className="live-qr" src={qr} alt="사진 올리는 QR" />}
        <p className="live-sub">카메라로 QR을 비춰주세요<br />앱 설치 없이 바로</p>
        {enabled && items.length > 0 && <p className="live-count">지금까지 {items.length}장</p>}
      </aside>
    </div>
  );
}
