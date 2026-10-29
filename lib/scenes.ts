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
  { key: "group", label: "단체사진" },
  { key: "guests", label: "하객" },
  { key: "party", label: "식사·피로연" },
  { key: "other", label: "기타" },
] as const;

export type SceneKey = (typeof SCENES)[number]["key"];
export const SCENE_KEYS = SCENES.map((s) => s.key) as readonly string[];
export const sceneLabel = (k: string) => SCENES.find((s) => s.key === k)?.label ?? "기타";
