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

// Sends a few photo previews in one request and returns one label per photo.
export async function classify(urls: string[]): Promise<string[]> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("NO_KEY");
  const content = [
    ...urls.flatMap((url, i) => [
      { type: "text", text: `Photo ${i + 1}:` },
      { type: "image", source: { type: "url", url } },
    ]),
    { type: "text", text: PROMPT },
  ];
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: MODEL, max_tokens: 300, messages: [{ role: "user", content }] }),
  });
  if (!r.ok) throw new Error(`AI ${r.status}: ${(await r.text()).slice(0, 300)}`);
  const d = await r.json();
  const text: string = (d.content ?? []).map((c: { text?: string }) => c.text ?? "").join("");
  let labels: string[] = [];
  try { labels = JSON.parse(text.slice(text.indexOf("["), text.lastIndexOf("]") + 1)); } catch { labels = []; }
  return urls.map((_, i) => (SCENE_KEYS.includes(labels[i]) ? labels[i] : "other"));
}
