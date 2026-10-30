import { admin, BUCKET } from "@/lib/supabase";
import { SCENE_KEYS } from "@/lib/scenes";

// Scene results are kept as one small JSON file per wedding in storage
// (scenes/<wedding id>.json → { mediaId: sceneKey }), so no database change is needed.
export const scenesPath = (weddingId: string) => `scenes/${weddingId}.json`;

export async function readScenes(weddingId: string): Promise<Record<string, string>> {
  const { data } = await admin().storage.from(BUCKET).download(scenesPath(weddingId));
  if (!data) return {};
  try { return JSON.parse(await data.text()) ?? {}; } catch { return {}; }
}

export async function writeScenes(weddingId: string, map: Record<string, string>) {
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
groom_entrance = the groom walking in down the aisle
bride_entrance = the bride walking in down the aisle (often with her father)
bow = the couple bowing to each other or to the parents, or exchanging vows on stage
speech = someone giving a speech or blessing at a microphone/podium
song = someone singing (축가) for the couple
rings = exchanging rings or gifts
march = the couple walking out together (행진), confetti, applause
group = large posed group photo on stage
guests = guests themselves, selfies, friends, people at tables
party = food, banquet, reception hall, after-party
other = anything else (venue, decorations, blurry, objects)
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
