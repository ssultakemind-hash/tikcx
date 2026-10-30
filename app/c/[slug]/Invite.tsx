"use client";
import { useEffect, useState } from "react";
import { siteOrigin } from "@/lib/site";
import QRCode from "qrcode";
import SaveImageButton from "../../SaveImageButton";
import { useCopy } from "@/lib/copy";
import { withSource } from "@/lib/sources";

// Couple-side: everything they need to invite guests, kept apart from their private link.
export default function Invite({ slug, names, defaultOpen }: { slug: string; names: string; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const [qr, setQr] = useState("");
  const { copied, copy } = useCopy();
  const base = typeof window !== "undefined" ? `${siteOrigin()}/w/${slug}` : "";
  const guestUrl = base ? withSource(base, "invite") : "";
  const invitation = `오늘 찍어주신 사진, 저희에게 나눠주세요.\n앱 설치 없이 바로 올릴 수 있어요.\n${guestUrl}`;

  useEffect(() => { setOpen(defaultOpen); }, [defaultOpen]);
  useEffect(() => {
    if (open && base) QRCode.toDataURL(withSource(base, "qr"), { width: 1024, margin: 2, color: { dark: "#1d1d1f", light: "#ffffff" } }).then(setQr).catch(() => {});
  }, [open, base]);

  if (!open) {
    return <button className="btn ghost" type="button" onClick={() => setOpen(true)}>하객 초대하기 (링크 · QR)</button>;
  }

  return (
    <section className="card">
      <div>
        <div className="eyebrow">하객 초대하기</div>
        <h2>모바일 청첩장에 이 링크를 넣어주세요</h2>
      </div>
      <p className="muted">하객분들은 이 링크나 QR로 사진을 올릴 수 있어요. 원본 저장과 삭제는 두 분만 할 수 있어요.</p>
      {qr && <img className="qr center" src={qr} alt={`${names} 하객 업로드 QR`} />}
      <button className="btn" type="button" onClick={() => copy(invitation, "inv")}>
        {copied === "inv" ? "복사됐어요" : "청첩장용 문구 복사"}
      </button>
      <div className="row two">
        <button className="btn ghost small" type="button" onClick={() => copy(guestUrl, "url")}>{copied === "url" ? "복사됨" : "링크만 복사"}</button>
        {qr && <SaveImageButton dataUrl={qr} filename={`tikcx-${slug}-qr.png`} />}
      </div>
      <p className="notice">지금 보고 계신 이 페이지 주소는 두 분만 간직해 주세요. 이 주소가 있으면 모든 사진을 보고 지울 수 있어요.</p>
      {!defaultOpen && <button className="btn ghost small" type="button" onClick={() => setOpen(false)}>접기</button>}
    </section>
  );
}
