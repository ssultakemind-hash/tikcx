// Where a guest came from. Added to links as ?from=<id>.
export const SOURCES = [
  { id: "screen", label: "대기실 화면" },
  { id: "card", label: "테이블 카드" },
  { id: "invite", label: "청첩장 링크" },
  { id: "qr", label: "기타 QR" },
  { id: "direct", label: "주소로 바로" },
] as const;
export type SourceId = (typeof SOURCES)[number]["id"];

export function cleanSource(v: unknown): SourceId {
  return SOURCES.some((s) => s.id === v) ? (v as SourceId) : "direct";
}

export function withSource(url: string, src: SourceId) {
  return `${url}${url.includes("?") ? "&" : "?"}from=${src}`;
}
