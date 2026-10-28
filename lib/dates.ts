// Retention rules, all counted in Korean dates from the wedding day.
export const UPLOAD_DAYS = 7;   // guests can upload until wedding + 7 days
export const KEEP_DAYS = 30;    // album is deleted after wedding + 30 days
export const WARN_DAYS = 7;     // couple sees a warning in the last 7 days

export function kstToday(): string {
  return new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
}

export function addDays(date: string, n: number): string {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(to + "T00:00:00Z") - Date.parse(from + "T00:00:00Z")) / 86400_000);
}

export type Phase = {
  uploadOpen: boolean;
  expired: boolean;
  uploadUntil: string | null;   // last day guests can upload
  deleteOn: string | null;      // day the album is deleted
  daysLeft: number | null;      // days until deletion
};

export function phase(weddingDate: string | null, today = kstToday()): Phase {
  if (!weddingDate) return { uploadOpen: true, expired: false, uploadUntil: null, deleteOn: null, daysLeft: null };
  const uploadUntil = addDays(weddingDate, UPLOAD_DAYS);
  const deleteOn = addDays(weddingDate, KEEP_DAYS);
  const daysLeft = daysBetween(today, deleteOn);
  return { uploadOpen: today <= uploadUntil, expired: daysLeft <= 0, uploadUntil, deleteOn, daysLeft };
}

export function shortDate(d: string | null) {
  if (!d) return "";
  const [, m, day] = d.split("-");
  return `${Number(m)}월 ${Number(day)}일`;
}
