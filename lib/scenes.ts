// Scene labels the AI sorts wedding photos into, in ceremony order.
// Shared by the server (classification) and the couple's gallery (filter chips).
export const SCENES = [
  { key: "bride", label: "신부" },
  { key: "groom", label: "신랑" },
  { key: "couple", label: "신랑·신부" },
  { key: "family", label: "가족·부모님" },
  { key: "groom_entrance", label: "신랑 입장" },
  { key: "bride_entrance", label: "신부 입장" },
  { key: "bow", label: "맞절·인사" },
  { key: "speech", label: "축사·덕담" },
  { key: "song", label: "축가" },
  { key: "rings", label: "예물 교환" },
  { key: "march", label: "행진·퇴장" },
  { key: "pyebaek", label: "폐백" },
  { key: "greeting", label: "하객 인사" },
  { key: "photo_op", label: "기념사진" },
  { key: "group", label: "단체사진" },
  { key: "guests", label: "하객" },
  { key: "party", label: "식사" },
  { key: "decor", label: "데코·플라워" },
  { key: "venue", label: "예식장·공간" },
  { key: "detail", label: "소품·디테일" },
  { key: "other", label: "기타" },
] as const;

export type SceneKey = (typeof SCENES)[number]["key"];
export const SCENE_KEYS = SCENES.map((s) => s.key) as readonly string[];
export const sceneLabel = (k: string) => SCENES.find((s) => s.key === k)?.label ?? "기타";

// The feeling of a photo (a second way to browse, and the backbone of the highlight film).
// "none" = no clear feeling (flowers, venue, objects); never shown as a chip.
export const MOODS = [
  { key: "flutter", label: "설렘" },
  { key: "nervous", label: "떨림" },
  { key: "joy", label: "기쁨" },
  { key: "cheer", label: "환호" },
  { key: "moved", label: "감동" },
  { key: "tears", label: "눈물" },
  { key: "love", label: "다정함" },
  { key: "welcome", label: "반가움" },
  { key: "wit", label: "위트" },
  { key: "cute", label: "귀여움" },
  { key: "calm", label: "차분함" },
] as const;
export const MOOD_KEYS = MOODS.map((m) => m.key) as readonly string[];
export const moodLabel = (k: string) => MOODS.find((m) => m.key === k)?.label ?? "";
