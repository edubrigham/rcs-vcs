"use client";

import { useState } from "react";
import type { TrafficEntry } from "@/components/apiClient";

/**
 * The single responses panel for the API page: one accordion log holding every
 * call (the live /analyze row pinned at top, media-info + improve below). Each
 * row is collapsed by default; expanding shows the ReadMe-style Request +
 * Response code boxes.
 */
export default function ApiConsole({
  entries,
  scoring,
  onClear,
  onImprove,
  improving,
  canImprove,
}: {
  entries: TrafficEntry[];
  scoring: boolean;
  onClear: () => void;
  onImprove: () => void;
  improving: boolean;
  canImprove: boolean;
}) {
  return (
    <section className="min-w-0 rounded-xl border border-line bg-panel">
      <header className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-2.5">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">Request log · {entries.length}</h2>
        {scoring && (
          <span className="flex items-center gap-1 font-mono text-[10px] text-[var(--color-primary)]">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--color-primary)]" />
            analyzing…
          </span>
        )}
        <div className="ml-auto flex items-center gap-3">
          <button
            type="button"
            onClick={onImprove}
            disabled={!canImprove || improving}
            className="rounded-lg border border-line bg-panel px-3 py-1.5 text-xs font-medium text-body transition hover:border-line-strong disabled:opacity-50"
          >
            {improving ? "Improving…" : "Run improver →"}
          </button>
          <button
            type="button"
            onClick={onClear}
            disabled={entries.length === 0}
            className="font-mono text-[11px] text-muted transition hover:text-body disabled:opacity-40"
          >
            clear
          </button>
        </div>
      </header>
      {entries.length === 0 ? (
        <p className="px-4 py-14 text-center text-sm text-muted">
          Paste a public media URL on the left — the API fires once a valid URL is fetched.
        </p>
      ) : (
        <ul className="divide-y divide-line">
          {entries.map((e) => (
            <LogRow key={e.id} entry={e} />
          ))}
        </ul>
      )}
    </section>
  );
}

function LogRow({ entry }: { entry: TrafficEntry }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="px-3 py-2.5">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-2.5 text-left">
        <span className="font-mono text-[10px] text-muted">{open ? "▾" : "▸"}</span>
        <span className="rounded bg-[var(--color-primary)]/12 px-1.5 py-0.5 font-mono text-[10px] font-bold text-[var(--color-primary)]">
          {entry.method}
        </span>
        <span className="truncate font-mono text-xs text-body">{entry.path}</span>
        <span className="ml-auto">
          <StatusPill status={entry.status} ok={entry.ok} />
        </span>
        <span className="font-mono text-[10px] text-muted">{entry.ms}ms</span>
      </button>
      {open && (
        <div className="mt-2.5 space-y-2">
          <CodePanel title="Request" subtitle={`${entry.method} ${entry.path}`} value={entry.request} />
          <CodePanel title="Response" status={entry.status} ok={entry.ok} value={entry.response} />
        </div>
      )}
    </li>
  );
}

function StatusPill({ status, ok }: { status: number; ok: boolean }) {
  return (
    <span className="flex items-center gap-1 font-mono text-[10px]" style={{ color: ok ? "#1a7f37" : "#cf222e" }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: ok ? "#1a7f37" : "#cf222e" }} />
      {status || "ERR"}
    </span>
  );
}

function CodePanel({
  title,
  subtitle,
  status,
  ok,
  value,
}: {
  title: string;
  subtitle?: string;
  status?: number;
  ok?: boolean;
  value: unknown;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-line bg-panel-strong">
      <div className="flex items-center justify-between border-b border-line px-3 py-1.5">
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted">{title}</span>
        {subtitle ? (
          <span className="font-mono text-[10px] text-muted">{subtitle}</span>
        ) : status != null ? (
          <StatusPill status={status} ok={!!ok} />
        ) : null}
      </div>
      <CodeBody value={value} />
    </div>
  );
}

const TOKEN_COLOR: Record<string, string> = {
  key: "#1f6feb",
  str: "#0a7c2f",
  num: "#b35900",
  bool: "#8250df",
  null: "#cf222e",
};

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Minimal, XSS-safe JSON highlighter → HTML per line (input is escaped first). */
function highlightLines(json: string): string[] {
  const html = escapeHtml(json).replace(
    /("(?:\\.|[^"\\])*"(?:\s*:)?|\b(?:true|false)\b|\bnull\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g,
    (m) => {
      let cls = "num";
      if (m.startsWith('"')) cls = m.trimEnd().endsWith(":") ? "key" : "str";
      else if (m === "true" || m === "false") cls = "bool";
      else if (m === "null") cls = "null";
      return `<span style="color:${TOKEN_COLOR[cls]}">${m}</span>`;
    },
  );
  return html.split("\n");
}

function CodeBody({ value }: { value: unknown }) {
  const lines = highlightLines(JSON.stringify(value, null, 2) ?? "null");
  return (
    <div className="py-2 text-[11px] leading-[1.65]" style={{ maxHeight: "16rem", overflow: "auto" }}>
      <div style={{ width: "max-content", minWidth: "100%" }}>
        {lines.map((html, i) => (
          <div key={i} className="flex px-3">
          <span className="mr-3 w-7 shrink-0 select-none text-right font-mono text-faint">{i + 1}</span>
          <code
            className="whitespace-pre font-mono text-body"
            dangerouslySetInnerHTML={{ __html: html || " " }}
          />
          </div>
        ))}
      </div>
    </div>
  );
}
