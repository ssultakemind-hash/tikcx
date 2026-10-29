"use client";
import QRCode from "qrcode";

// Table card image: A6 portrait at 300dpi (105 x 148 mm), ready to print.
const W = 1240, H = 1748;
const SANS = '"Pretendard Variable", Pretendard, "Apple SD Gothic Neo", sans-serif';
const LOGO = '"Plus Jakarta Sans", sans-serif';

function dateLine(date: string | null, venue: string | null) {
  let d = "";
  if (date) {
    const dt = new Date(date + "T00:00:00");
    const days = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
    d = `${dt.getFullYear()}. ${dt.getMonth() + 1}. ${dt.getDate()} ${days[dt.getDay()]}`;
  }
  return [d, venue].filter(Boolean).join("  ·  ");
}

async function loadFonts(texts: string[]) {
  try {
    await Promise.all([
      document.fonts.load(`800 64px ${LOGO}`, "tikcx."),
      ...texts.map((t) => document.fonts.load(`800 80px ${SANS}`, t)),
      ...texts.map((t) => document.fonts.load(`500 40px ${SANS}`, t)),
    ]);
  } catch { /* fall back to system fonts */ }
}

function roundRect(x: CanvasRenderingContext2D, l: number, t: number, w: number, h: number, r: number) {
  x.beginPath();
  x.moveTo(l + r, t); x.arcTo(l + w, t, l + w, t + h, r); x.arcTo(l + w, t + h, l, t + h, r);
  x.arcTo(l, t + h, l, t, r); x.arcTo(l, t, l + w, t, r); x.closePath();
}

export async function makeCard(opts: { url: string; names: string; date: string | null; venue: string | null }): Promise<string> {
  const head1 = "오늘 찍은 사진,", head2 = "여기에 모아주세요";
  const info = dateLine(opts.date, opts.venue);
  const texts = ["와주셔서 고마워요", head1, head2, "카메라로 QR을 비춰주세요", "앱 설치, 가입 없이 바로 올려요 · 영상은 30초 이내로", opts.names, info, "TAKEMIND"];
  await loadFonts(texts);

  const qr = new Image();
  qr.src = await QRCode.toDataURL(opts.url, { width: 1200, margin: 0, color: { dark: "#0A0A0A", light: "#FFFFFF" }, errorCorrectionLevel: "M" });
  await qr.decode();

  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const x = c.getContext("2d")!;
  x.fillStyle = "#FFFFFF"; x.fillRect(0, 0, W, H);
  x.textAlign = "center"; x.textBaseline = "alphabetic"; x.fillStyle = "#0A0A0A";

  // logo
  x.font = `800 60px ${LOGO}`;
  x.fillText("tikcx.", W / 2, 170);

  // greeting + headline
  x.fillStyle = "#86868B"; x.font = `500 38px ${SANS}`;
  x.fillText("와주셔서 고마워요", W / 2, 280);
  x.fillStyle = "#0A0A0A"; x.font = `800 84px ${SANS}`;
  x.fillText(head1, W / 2, 390);
  x.fillText(head2, W / 2, 490);

  // QR on a soft panel
  const qs = 620, ql = (W - qs) / 2, qt = 600, pad = 44;
  x.fillStyle = "#F5F5F7"; roundRect(x, ql - pad, qt - pad, qs + pad * 2, qs + pad * 2, 48); x.fill();
  x.fillStyle = "#FFFFFF"; roundRect(x, ql - 18, qt - 18, qs + 36, qs + 36, 24); x.fill();
  x.drawImage(qr, ql, qt, qs, qs);

  // how to
  x.fillStyle = "#0A0A0A"; x.font = `700 44px ${SANS}`;
  x.fillText("카메라로 QR을 비춰주세요", W / 2, 1372);
  x.fillStyle = "#86868B"; x.font = `500 30px ${SANS}`;
  x.fillText("앱 설치, 가입 없이 바로 올려요 · 영상은 30초 이내로", W / 2, 1426);

  // couple
  x.strokeStyle = "#E5E5EA"; x.lineWidth = 3;
  x.beginPath(); x.moveTo(W / 2 - 60, 1488); x.lineTo(W / 2 + 60, 1488); x.stroke();
  x.fillStyle = "#0A0A0A"; x.font = `700 50px ${SANS}`;
  x.fillText(opts.names, W / 2, 1572);
  if (info) { x.fillStyle = "#86868B"; x.font = `500 30px ${SANS}`; x.fillText(info, W / 2, 1624); }

  // footer
  x.fillStyle = "#B0B0B5"; x.font = `600 22px ${SANS}`;
  x.fillText("tikcx.  ×  TAKEMIND", W / 2, 1700);

  return c.toDataURL("image/png");
}
