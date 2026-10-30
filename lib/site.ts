// The address printed on QR codes, cards and KakaoTalk messages.
// Always the short official domain, even when the admin page is opened at tikcx.vercel.app.
// (On a local test computer the local address is used so links keep working.)
export const SITE = "https://tikcx.com";

export function siteOrigin() {
  if (typeof window === "undefined") return SITE;
  const h = window.location.hostname;
  return h === "localhost" || h === "127.0.0.1" || h.endsWith(".local") ? window.location.origin : SITE;
}
