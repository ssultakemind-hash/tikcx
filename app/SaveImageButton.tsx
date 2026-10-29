"use client";
import { useState } from "react";

function isMobile() {
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

async function toFile(dataUrl: string, filename: string) {
  const blob = await fetch(dataUrl).then((r) => r.blob());
  return new File([blob], filename, { type: blob.type || "image/png" });
}

// Saves an image the way each device expects:
// phone → share sheet ("이미지 저장" puts it in Photos); computer → normal download;
// if neither works → shows the image big so it can be long-pressed and saved.
export default function SaveImageButton({ dataUrl, filename, label = "QR 저장", className = "btn ghost small" }: {
  dataUrl: string; filename: string; label?: string; className?: string;
}) {
  const [fallback, setFallback] = useState(false);

  async function save() {
    if (isMobile()) {
      try {
        const file = await toFile(dataUrl, filename);
        if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file] }); return; }
      } catch (e) {
        if ((e as Error)?.name === "AbortError") return;
      }
      setFallback(true);
      return;
    }
    const a = document.createElement("a");
    a.href = dataUrl; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
  }

  return (
    <>
      <button className={className} type="button" onClick={save}>{label}</button>
      {fallback && (
        <div className="viewer" role="dialog" aria-modal="true" aria-label="이미지 저장">
          <button className="close" type="button" onClick={() => setFallback(false)}>닫기</button>
          <div className="stage"><img src={dataUrl} alt="저장할 이미지" style={{ background: "#fff" }} /></div>
          <p className="vinfo">이미지를 <b>길게 눌러</b> '사진 앱에 저장'을 고르세요.</p>
        </div>
      )}
    </>
  );
}
