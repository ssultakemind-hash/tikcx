"use client";
import { useRef } from "react";

// Every poll returns fresh signed links, and a new link makes the browser download
// the same picture again. This keeps the first link for each photo (refreshed after
// 40 minutes, before the 1-hour link expires) so each picture is downloaded once.
const MAX_AGE_MS = 40 * 60 * 1000;

export function useStableUrls() {
  const seen = useRef(new Map<string, { url: string; at: number }>());
  return <T extends { id: string; thumb: string }>(items: T[]): T[] => {
    const now = Date.now();
    return items.map((it) => {
      const prev = seen.current.get(it.id);
      if (prev && now - prev.at < MAX_AGE_MS) return { ...it, thumb: prev.url };
      seen.current.set(it.id, { url: it.thumb, at: now });
      return it;
    });
  };
}
