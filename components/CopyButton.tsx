"use client";

import { useState } from "react";

/**
 * Tiny client island: copies a string to the clipboard. The reference page that
 * hosts it is a server component — only this button hydrates, so the docs still
 * render instantly with zero client work.
 */
export default function CopyButton({ text, label = "JSON" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      aria-live="polite"
      aria-label={copied ? "Copied" : `Copy ${label}`}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1400);
        } catch {
          /* clipboard unavailable (insecure context) — no-op */
        }
      }}
      className="rounded-md border border-line bg-panel px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted transition hover:border-line-strong hover:text-body focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-ring)]"
    >
      {copied ? "Copied ✓" : "Copy"}
    </button>
  );
}
