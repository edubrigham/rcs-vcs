import CopyButton from "./CopyButton";

/**
 * Server-rendered JSON code block with line numbers and the same token palette
 * as the API console. Pure string→HTML (no hooks), so it ships in the initial
 * HTML — no client JS to read the docs. The optional copy control is the only
 * part that hydrates.
 */
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

export default function JsonBlock({
  title,
  value,
  copy = false,
}: {
  title: string;
  value: unknown;
  copy?: boolean;
}) {
  const json = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  const lines = highlightLines(json);
  return (
    <div className="overflow-hidden rounded-lg border border-line bg-panel-strong">
      <div className="flex items-center justify-between gap-3 border-b border-line px-3 py-1.5">
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted">{title}</span>
        {copy && <CopyButton text={json} />}
      </div>
      <div className="py-2 text-[11px] leading-[1.65]" style={{ maxHeight: "24rem", overflow: "auto" }}>
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
    </div>
  );
}
