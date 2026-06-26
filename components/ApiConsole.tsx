"use client";

import { useState } from "react";
import type { TrafficEntry } from "@/components/apiClient";

/** Devtools-style request/response log for the API playground. Presentation only. */
export default function ApiConsole({ entries, onClear }: { entries: TrafficEntry[]; onClear: () => void }) {
  return (
    <section className="rounded-xl border border-line bg-panel">
      <header className="flex items-center justify-between border-b border-line px-4 py-2.5">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">API console · {entries.length}</h2>
        <button type="button" onClick={onClear} className="font-mono text-[11px] text-muted transition hover:text-body">
          clear
        </button>
      </header>
      {entries.length === 0 ? (
        <p className="px-4 py-6 text-center text-xs text-muted">No requests yet — edit the card or fetch a URL.</p>
      ) : (
        <ul className="divide-y divide-line">
          {entries.map((e) => (
            <Row key={e.id} entry={e} />
          ))}
        </ul>
      )}
    </section>
  );
}

function Row({ entry }: { entry: TrafficEntry }) {
  const [open, setOpen] = useState(false);
  return (
    <li>
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-3 px-4 py-2 text-left">
        <span className="font-mono text-[10px] text-muted">{open ? "▾" : "▸"}</span>
        <span className="font-mono text-[11px] font-semibold text-body">{entry.method}</span>
        <span className="font-mono text-[11px] text-body">{entry.path}</span>
        <span
          className={`ml-auto rounded px-1.5 py-0.5 font-mono text-[10px] ${
            entry.ok
              ? "bg-[var(--color-secondary)]/15 text-[var(--color-secondary)]"
              : "bg-[var(--color-destructive)]/15 text-[var(--color-destructive)]"
          }`}
        >
          {entry.status || "ERR"}
        </span>
        <span className="font-mono text-[10px] text-muted">{entry.ms}ms</span>
      </button>
      {open && (
        <div className="grid gap-2 px-4 pb-3 md:grid-cols-2">
          <Json label="request" value={entry.request} />
          <Json label="response" value={entry.response} />
        </div>
      )}
    </li>
  );
}

function Json({ label, value }: { label: string; value: unknown }) {
  return (
    <div>
      <p className="mb-1 font-mono text-[10px] uppercase tracking-wider text-faint">{label}</p>
      <pre className="max-h-64 overflow-auto rounded-lg border border-line bg-field p-2 font-mono text-[10px] leading-relaxed text-body">
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}
