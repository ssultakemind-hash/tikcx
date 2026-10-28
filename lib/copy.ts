"use client";
import { useState } from "react";

// Copy to clipboard with a short "복사됨" confirmation on the button.
export function useCopy() {
  const [copied, setCopied] = useState<string | null>(null);
  async function copy(text: string, id: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); } catch {}
      ta.remove();
    }
    setCopied(id);
    setTimeout(() => setCopied((c) => (c === id ? null : c)), 1800);
  }
  return { copied, copy };
}

export function shortUrl(url: string) {
  return url.replace(/^https?:\/\//, "");
}
