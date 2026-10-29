export const TIMINGS = ["6개월 이내", "6개월~1년", "1년 이후", "아직 미정"] as const;
export const INTERESTS = ["웨딩홀", "스튜디오 촬영", "드레스", "메이크업", "본식 스냅", "청첩장"] as const;
export const STATUSES = [
  { id: "new", label: "새로 들어옴" },
  { id: "contacted", label: "연락함" },
  { id: "consulting", label: "상담 중" },
  { id: "booked", label: "계약" },
  { id: "closed", label: "진행 안 함" },
] as const;
export const LEAD_KEEP_DAYS = 365; // contact details are kept 1 year unless withdrawn earlier

export function normalizePhone(p: string) {
  const d = p.replace(/\D/g, "");
  if (!/^01[016789]\d{7,8}$/.test(d)) return null;
  return d.length === 11 ? `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}` : `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
}
