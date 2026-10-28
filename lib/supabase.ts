import { createClient } from "@supabase/supabase-js";

// Server-only client. Never import this from a client component.
export function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase 환경변수가 설정되지 않았습니다.");
  return createClient(url, key, { auth: { persistSession: false } });
}

export const BUCKET = "media";
export const MAX_FILE_BYTES = 50 * 1024 * 1024;
export const MAX_FILES_PER_BATCH = 50;

export type Wedding = {
  id: string;
  slug: string;
  couple_names: string;
  wedding_date: string | null;
  venue: string | null;
  couple_key: string;
  guest_gallery: boolean;
};

export async function weddingBySlug(slug: string) {
  const { data } = await admin()
    .from("weddings")
    .select("id, slug, couple_names, wedding_date, venue, couple_key, guest_gallery")
    .eq("slug", slug)
    .maybeSingle();
  return (data as Wedding | null) ?? null;
}

export function formatDate(d: string | null) {
  if (!d) return "";
  const dt = new Date(d + "T00:00:00");
  const days = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
  return `${dt.getFullYear()}. ${dt.getMonth() + 1}. ${dt.getDate()} ${days[dt.getDay()]}`;
}
