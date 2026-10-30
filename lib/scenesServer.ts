import { admin, BUCKET } from "@/lib/supabase";
import { MOOD_KEYS, SCENE_KEYS } from "@/lib/scenes";

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
export const AI = "__ai"; // { mediaId: what the AI said }
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
photo_op = a posed souvenir photo: people deliberately posing and looking at the camera, arranged by the photographer (the couple with family, friends, coworkers or relatives, or the couple posing to camera). Natural, candid moments are NOT photo_op.
group = the large posed group photo of all guests on stage
Tip: if people are clearly posing and looking at the camera, choose photo_op (or group for the big all-guest photo) rather than couple/family/guests.
guests = guests themselves, selfies, friends, people at tables
party = food and dishes, banquet tables, buffet
decor = flowers, bouquets, floral arrangements, table and stage decorations
venue = the wedding hall, stage, garden or building without people as the subject
detail = close-ups of objects: rings, shoes, invitations, name cards, cake, gifts
other = anything else (blurry, accidental, screenshots)
unsafe = nudity or sexual content, graphic violence or blood, hateful symbols, obscene gestures, or anything clearly inappropriate to show on a screen at a wedding
Use "unsafe" only when it is clearly inappropriate; a normal wedding photo is never unsafe.
Tip: a couple walking among guests or through a room after the ceremony is "greeting", not an entrance.
Also pick the ONE feeling the photo shows most (look at faces and the moment):
flutter = excitement, anticipation (설렘)   nervous = tension, nervousness (떨림)
joy = happiness, smiles (기쁨)   cheer = cheering, applause, celebration (환호)
moved = being moved, solemn emotion (감동)   tears = crying, wiping tears (눈물)
love = tenderness between people, affection (다정함)   welcome = happy reunion, greeting friends (반가움)
wit = funny, playful, silly (위트)   cute = children or something adorable (귀여움)
calm = quiet, peaceful (차분함)   none = no person or no clear feeling (objects, flowers, venue)
Answer with ONLY a JSON array with one [scene, feeling] pair per photo, e.g. [["bride","flutter"],["decor","none"]].`;

export class ClassifyError extends Error {}

// Sends a few photo previews (as image data, not links) in one request and returns
// one label per photo. Throws ClassifyError if the answer can't be read, so the
// photos stay unsorted and can be retried instead of all becoming "기타".
export type Label = { scene: string; mood: string };

export async function classify(thumbPaths: string[]): Promise<Label[]> {
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
    body: JSON.stringify({ model: MODEL, max_tokens: 600, messages: [{ role: "user", content }] }),
  });
  if (!r.ok) throw new ClassifyError(`AI ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const d = await r.json();
  const text: string = (d.content ?? []).map((c: { text?: string }) => c.text ?? "").join("");
  return readLabels(text, thumbPaths.length).map((l, i) => (images[i] ? l : { scene: "other", mood: "none" }));
}

const okScene = (l: string) => SCENE_KEYS.includes(l) || l === "unsafe";
const okMood = (l: string) => MOOD_KEYS.includes(l) || l === "none";

// Reads the AI's answer even with code fences, capitals or extra words; older answers
// without feelings still work. Throws if it can't find one label per photo.
export function readLabels(text: string, n: number): Label[] {
  let out: Label[] = [];
  try {
    const arr = JSON.parse(text.slice(text.indexOf("["), text.lastIndexOf("]") + 1));
    if (Array.isArray(arr)) out = arr.map((x) => {
      const pair = Array.isArray(x) ? x : typeof x === "object" && x ? [x.scene ?? x.s, x.mood ?? x.m ?? x.feeling] : [x];
      const s = String(pair[0] ?? "").trim().toLowerCase(), m = String(pair[1] ?? "none").trim().toLowerCase();
      return { scene: okScene(s) ? s : "other", mood: okMood(m) ? m : "none" };
    });
  } catch { /* fall back below */ }
  if (out.length < n) {
    // pick words in order: a scene word, then (optionally) a feeling word
    const words = [...text.toLowerCase().matchAll(/[a-z_]+/g)].map((m) => m[0]);
    out = [];
    for (let i = 0; i < words.length; i++) {
      if (!okScene(words[i])) continue;
      const next = words[i + 1];
      out.push({ scene: words[i], mood: next && okMood(next) && !okScene(next) ? next : "none" });
    }
  }
  if (out.length < n) throw new ClassifyError(`AI answer unreadable: ${text.slice(0, 200)}`);
  return out.slice(0, n);
}
