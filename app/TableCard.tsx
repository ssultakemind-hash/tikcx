"use client";
import { useEffect, useState } from "react";
import { makeCard } from "@/lib/card";
import SaveImageButton from "./SaveImageButton";

// Preview + save of the printable table card (QR, guide text, couple names).
export default function TableCard({ url, slug, names, date, venue }: { url: string; slug: string; names: string; date: string | null; venue: string | null }) {
  const [card, setCard] = useState("");
  useEffect(() => {
    if (!url) return;
    makeCard({ url, names, date, venue }).then(setCard).catch(() => setCard(""));
  }, [url, names, date, venue]);

  if (!card) return <p className="muted">테이블 카드 만드는 중…</p>;
  return (
    <div className="table-card">
      <img src={card} alt={`${names} 테이블 카드 미리보기`} />
      <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
        <p className="muted">식장 테이블에 세워둘 안내 카드예요. A6(엽서) 크기로 인쇄하면 돼요.</p>
        <SaveImageButton dataUrl={card} filename={`tikcx-${slug}-card.png`} label="테이블 카드 저장" className="btn small" />
      </div>
    </div>
  );
}
