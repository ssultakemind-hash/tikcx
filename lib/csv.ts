"use client";

// Saves a table as a CSV file that opens correctly in Excel/Numbers (Korean text included).
// File names stay English: some phones and browsers drop Korean names.
export function saveCsv(filename: string, head: string[], rows: (string | number | null | undefined)[][]) {
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const text = "﻿" + [head.map(esc).join(","), ...rows.map((r) => r.map(esc).join(","))].join("\n");
  const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
  const file = new File([blob], filename, { type: "text/csv" });
  const mobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  if (mobile && navigator.canShare?.({ files: [file] })) { navigator.share({ files: [file] }).catch(() => {}); return; }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 60_000);
}

export const today = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
