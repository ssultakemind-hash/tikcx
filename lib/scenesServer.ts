import { admin, BUCKET } from "@/lib/supabase";
import { SCENE_KEYS } from "@/lib/scenes";

// Scene results are kept as one small JSON file per wedding in storage
// (scenes/<wedding id>.json → { mediaId: sceneKey }), so no database change is needed.
export const scenesPath = (weddingId: string) => `scenes/${weddingId}.json`;

export async function readScenes(weddingId: string): Promise<Record<string, any>> { // eslint-disable-line @typescript-eslint/no-explicit-any
  const { data } = await admin().storage.from(BUCKET).download(scenesPath(weddingId));
  if (!data) return {};
  try { return JSON.parse(await data.text()) ?? {}; } catch { return {}; }
}

// Photos the couple moved by hand. Kept under "__manual" in the same file and never
// overwritten by "다시 정리".
export const MANUAL = "__manual";
export function manualIds(map: Record<string, unknown>): string[] {
  const m = map[MANUAL];
  return Array.isArray(m) ? m.filter((x) => typeof x === "string") : [];
}

export async function writeScenes(weddingId: string, map: Record<string, unknown>) {
  await admin().storage.from(BUCKET).upload(scenesPath(weddingId), JSON.stringify(map), { upsert: true, contentType: "application/json" });
}

export async function removeScenes(weddingId: string) {
  await admin().storage.from(BUCKET).remove([scenesPath(weddingId)]);
}

const MODEL = "claude-haiku-5-5";

const PROMPT = `These are photos taken by guests at a Korean wedding (예식). For each photo, in order, pick the ONE label that fits best:
bride = the bride alone (white wedding dress)
groom = the groom alone
couple = bride and groom together, posing or close-up (not during a ceremony moment below)
family = parents or family members (often in hanbok), with or without the couple
groom_entrance = the groom walking in down the aisle toward the stage, guests seated watching
bride_entrance = the bride walking in down the aisle toward the stage (often with her father), guests seated watching
bow = the couple bowing to each other or to the parents, or exchanging vows on stage
speech = someone giving a speech or blessing at a microphone/podium
song = someone singing (축가) for the couple
rings = exchanging rings or gifts during the ceremony
march = the couple walking out together after the ceremony (행진), confetti, applause
pyebaek = traditional Korean pyebaek ceremony: couple in hanbok bowing to parents, chestnuts and dates
greeting = the couple going around greeting guests at tables or in a hallway/room after the ceremony (often seen from behind, not on the aisle)
group = large posed group photo on stage
guests = guests themselves, selfies, friends, people at tables
party = food and dishes, banquet tables, buffet
decor = flowers, bouquets, floral arrangements, table and stage decorations
venue = the wedding hall, stage, garden or building without people as the subject
detail = close-ups of objects: rings, shoes, invitations, name cards, cake, gifts
other = anything else (blurry, accidental, screenshots)
Tip: a couple walking among guests or through a room after the ceremony is "greeting", not an entrance.
Answer with ONLY a JSON array of labels, one per photo, e.g. ["bride","guests"].`;

export class ClassifyError extends Error {}

// Sends a few photo previews (as image data, not links) in one request and returns
// one label per photo. Throws ClassifyError if the answer can't be read, so the
// photos stay unsorted and can be retried instead of all becoming "기타".
export async function classify(thumbPaths: string[]): Promise<string[]> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new ClassifyError("NO_KEY");
  const store = admin().storage.from(BUCKET);
  const images = await Promise.all(thumbPaths.map(async (p) => {
    const { data } = await store.download(p);
    if (!data) return null;
    return Buffer.from(await data.arrayBuffer()).toString("base64");
  }));
  const content = [
    ...images.flatMap((b64, i) => b64 ? [
      { type: "text", text: `Photo ${i + 1}:` },
      { type: "image", source: { type: "base64", media_type: "image/jpeg", data: b64 } },
    ] : [{ type: "text", text: `Photo ${i + 1}: (missing)` }]),
    { type: "text", text: PROMPT },
  ];
  const base = process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com";
  const r = await fetch(`${base}/v1/messages`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: MODEL, max_tokens: 400, messages: [{ role: "user", content }] }),
  });
  if (!r.ok) throw new ClassifyError(`AI ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const d = await r.json();
  const text: string = (d.content ?? []).map((c: { text?: string }) => c.text ?? "").join("");
  // Read labels in order, tolerating code fences, capitals or extra words around them.
  let labels: string[] = [];
  try {
    const arr = JSON.parse(text.slice(text.indexOf("["), text.lastIndexOf("]") + 1));
    if (Array.isArray(arr)) labels = arr.map((x) => String(x).trim().toLowerCase());
  } catch { /* fall back below */ }
  if (labels.length < thumbPaths.length)
    labels = [...text.toLowerCase().matchAll(/[a-z_]+/g)].map((m) => m[0]).filter((w) => SCENE_KEYS.includes(w));
  labels = labels.map((l) => (SCENE_KEYS.includes(l) ? l : "other"));
  if (labels.length < thumbPaths.length) throw new ClassifyError(`AI answer unreadable: ${text.slice(0, 200)}`);
  return thumbPaths.map((_, i) => (images[i] ? labels[i] : "other"));
}
