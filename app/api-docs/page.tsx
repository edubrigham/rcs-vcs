import type { Metadata } from "next";
import Link from "next/link";
import JsonBlock from "@/components/JsonBlock";

/**
 * API Reference — server-rendered, on-brand documentation for the scoring API.
 * Static content (no client fetch, no Swagger bundle), so it ships in the
 * initial HTML and renders with zero flicker. Live calls live on the playground
 * (`/api-playground`); the raw contract is `/api/openapi`.
 */
export const metadata: Metadata = {
  title: "API Reference · RCS Scoring API",
  description:
    "Reference for the Naxai RCS compatibility scoring API: one rcsContentBody in, functional compliance and iOS/Android quality out.",
};

const REQUEST_EXAMPLE = {
  type: "standaloneRichCard",
  cardOrientation: "VERTICAL",
  cardContent: {
    title: "Spring Collection",
    description: "New arrivals, free returns.",
    media: {
      height: "TALL",
      contentInfo: {
        fileUrl: "https://upload.wikimedia.org/wikipedia/commons/3/3f/JPEG_example_flower.jpg",
      },
    },
    suggestions: [
      { type: "action", text: "Shop now", action: { type: "openUrlAction", url: "https://example.com/shop" } },
      { type: "reply", text: "Notify me" },
    ],
  },
};

const ANALYZE_RESPONSE = {
  functional: { passes: true, violations: [] },
  quality: {
    overallScore: 92,
    iosScore: 90,
    androidScore: 94,
    imageSafeZoneScore: 100,
    textFitScore: 85,
    actionScore: 100,
    layoutScore: 90,
    warnings: [],
    recommendations: [],
  },
};

type Endpoint = { path: string; summary: string; returns: string; note?: string; recommended?: boolean };

const ENDPOINTS: Endpoint[] = [
  {
    path: "/analyze",
    summary: "Both axes in one call — functional compliance and the quality score.",
    returns: "{ functional, quality }",
    note: "The recommended one-shot.",
    recommended: true,
  },
  {
    path: "/validate",
    summary: "Functional compliance only — would sendRCS accept this card?",
    returns: "FunctionalResult",
  },
  { path: "/score", summary: "Quality only — 0–100, iOS vs Android rendering.", returns: "ScoreResult" },
  {
    path: "/improve",
    summary: "A deterministically improved card, plus the changes applied.",
    returns: "Improved standaloneRichCard",
  },
];

const UTILITY: Endpoint = {
  path: "/media-info",
  summary: "Introspect a public media URL (SSRF-guarded, header bytes only).",
  returns: "MediaIntrospection",
  note: "The utility the scorers call internally — not part of the scoring input.",
};

const SCHEMAS: { title: string; rows: [string, string, string?][] }[] = [
  {
    title: "FunctionalResult",
    rows: [
      ["passes", "boolean", "False if any hard limit is exceeded."],
      ["violations[]", "object", "limit · message · actual · max · citation"],
    ],
  },
  {
    title: "ScoreResult",
    rows: [
      ["overallScore", "0–100", "Weighted across the four sub-scores."],
      ["iosScore / androidScore", "0–100", "Per-platform rendering."],
      ["imageSafeZoneScore", "0–100", "Subject inside the centered safe zone."],
      ["textFitScore", "0–100", "Title/description fit before truncation."],
      ["actionScore", "0–100", "Suggestion count and labels."],
      ["layoutScore", "0–100", "Orientation and media height fit."],
      ["warnings / recommendations", "object[]", "Each cites its source slide."],
    ],
  },
  {
    title: "MediaIntrospection",
    rows: [
      ["mediaType", '"image" | "video"', "Derived from the fetched bytes."],
      ["mimeType", "string", ""],
      ["fileSizeBytes", "integer", ""],
      ["width / height / aspectRatio", "number", "Images only — videos omit dimensions."],
    ],
  },
];

const LIMITS: [string, string][] = [
  ["title", "≤ 200 characters"],
  ["description", "≤ 2000 characters"],
  ["suggestions", "≤ 4 per card"],
  ["suggestion label", "≤ 25 characters"],
  ["open-URL", "≤ 2048 characters"],
  ["media MIME", "supported types only"],
  ["thumbnail", "≤ 100 KB"],
];

const SECTIONS = [
  { id: "input", label: "The input" },
  { id: "endpoints", label: "Endpoints" },
  { id: "responses", label: "Responses" },
  { id: "limits", label: "Functional limits" },
];

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded bg-panel-strong px-1 py-0.5 font-mono text-[0.85em] text-heading break-words">
      {children}
    </code>
  );
}

function SectionHeading({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="mb-4 scroll-mt-24 font-display text-xl font-bold tracking-tight text-heading">
      {children}
    </h2>
  );
}

function MethodPill() {
  return (
    <span className="rounded bg-[var(--color-primary)]/12 px-2 py-0.5 font-mono text-[11px] font-bold text-[var(--color-primary)]">
      POST
    </span>
  );
}

function EndpointRow({ ep }: { ep: Endpoint }) {
  return (
    <li className="rounded-xl border border-line bg-panel p-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <MethodPill />
        <code className="min-w-0 font-mono text-sm font-semibold text-heading">/api{ep.path}</code>
        {ep.recommended && (
          <span className="rounded-full bg-[var(--color-secondary)]/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-secondary)]">
            Recommended
          </span>
        )}
        <span className="ml-auto font-mono text-[11px] text-muted">→ {ep.returns}</span>
      </div>
      <p className="mt-2 text-sm text-body">{ep.summary}</p>
      {ep.note && <p className="mt-1 text-xs text-muted">{ep.note}</p>}
    </li>
  );
}

export default function ApiDocsPage() {
  return (
    <main className="mx-auto w-full max-w-4xl px-5 py-10 sm:py-14">
      <header className="mb-12">
        <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.24em] text-faint">API Reference</p>
        <h1 className="font-display text-3xl font-bold tracking-tight text-heading text-balance sm:text-4xl">
          RCS Compatibility Scoring API
        </h1>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-body">
          Pre-flight scoring for a Naxai RCS rich card. One request — a single <Code>standaloneRichCard</Code> —
          scored on two independent axes.
        </p>

        <div className="mt-5 flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-2 rounded-full border border-line bg-panel px-3 py-1 text-xs">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-primary)]" aria-hidden="true" />
            <span className="font-semibold text-heading">Functional</span>
            <span className="text-muted">would sendRCS accept it</span>
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-line bg-panel px-3 py-1 text-xs">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-secondary)]" aria-hidden="true" />
            <span className="font-semibold text-heading">Quality</span>
            <span className="text-muted">iOS vs Android, 0–100</span>
          </span>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Link
            href="/api-playground"
            className="inline-flex items-center rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-[var(--color-primary-foreground)] transition hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-ring)]"
          >
            Open the live playground →
          </Link>
          <a
            href="/api/openapi"
            className="inline-flex items-center rounded-lg border border-line px-4 py-2 text-sm font-medium text-body transition hover:border-line-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-ring)]"
          >
            Raw OpenAPI ↗
          </a>
        </div>

        <nav aria-label="On this page" className="mt-8 flex flex-wrap gap-x-4 gap-y-1 border-t border-line pt-4">
          {SECTIONS.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className="font-mono text-[11px] text-muted underline-offset-4 transition hover:text-body hover:underline focus-visible:underline"
            >
              {s.label}
            </a>
          ))}
        </nav>
      </header>

      <section className="mb-12">
        <SectionHeading id="input">The input</SectionHeading>
        <div className="rounded-xl border border-line bg-panel p-5">
          <p className="text-[15px] leading-relaxed text-body">
            The request body is <strong className="font-semibold">exactly the Naxai <Code>rcsContentBody</Code></strong>{" "}
            — the <Code>standaloneRichCard</Code> arm, the same object you pass to RCS Broadcasts&rsquo;{" "}
            <Code>sendRCS</Code>. Nothing wraps it.
          </p>
          <ul className="mt-3 space-y-2 text-sm text-muted">
            <li className="flex gap-2">
              <span aria-hidden="true" className="text-faint">
                —
              </span>
              <span>
                The API fetches the media URL at <Code>cardContent.media.contentInfo.fileUrl</Code>{" "}
                <strong className="font-medium text-body">internally</strong> to derive size and dimensions. Media is
                never passed in.
              </span>
            </li>
            <li className="flex gap-2">
              <span aria-hidden="true" className="text-faint">
                —
              </span>
              <span>
                There is <strong className="font-medium text-body">no focal point</strong> in the input; the scorer
                centers the subject.
              </span>
            </li>
          </ul>
        </div>
        <div className="mt-4">
          <JsonBlock title="Request body · application/json" value={REQUEST_EXAMPLE} copy />
        </div>
      </section>

      <section className="mb-12">
        <SectionHeading id="endpoints">Endpoints</SectionHeading>
        <p className="mb-4 text-sm text-muted">
          Base URL <Code>/api</Code>. Every scoring endpoint takes the same <Code>rcsContentBody</Code> and answers{" "}
          <Code>200</Code> with the result, or <Code>400</Code> if the body is not a valid card.
        </p>
        <ul className="space-y-2.5">
          {ENDPOINTS.map((ep) => (
            <EndpointRow key={ep.path} ep={ep} />
          ))}
        </ul>
        <h3 className="mb-2.5 mt-6 font-mono text-[11px] uppercase tracking-[0.2em] text-faint">Utility</h3>
        <ul>
          <EndpointRow ep={UTILITY} />
        </ul>
      </section>

      <section className="mb-12">
        <SectionHeading id="responses">Responses</SectionHeading>
        <p className="mb-4 text-sm text-muted">
          <Code>/analyze</Code> returns both axes. A passing card:
        </p>
        <JsonBlock title="200 · POST /api/analyze" value={ANALYZE_RESPONSE} copy />
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {SCHEMAS.map((schema) => (
            <div key={schema.title} className="rounded-xl border border-line bg-panel p-4">
              <h3 className="mb-3 font-mono text-xs font-semibold text-heading">{schema.title}</h3>
              <dl className="space-y-2">
                {schema.rows.map(([name, type, desc]) => (
                  <div key={name} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[13px]">
                    <dt className="font-mono text-body">{name}</dt>
                    <dd className="font-mono text-[11px] text-[var(--color-primary)]">{type}</dd>
                    {desc ? <dd className="w-full text-xs text-muted">{desc}</dd> : null}
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
      </section>

      <section>
        <SectionHeading id="limits">Functional limits</SectionHeading>
        <p className="mb-4 text-sm text-muted">
          A card that exceeds any of these fails the functional axis — the values that make <Code>sendRCS</Code> return{" "}
          <Code>422</Code>. Source: the Naxai sendRCS OpenAPI.
        </p>
        <div className="overflow-hidden rounded-xl border border-line">
          <table className="w-full text-sm">
            <tbody className="divide-y divide-line">
              {LIMITS.map(([field, limit]) => (
                <tr key={field}>
                  <td className="px-4 py-2.5 font-mono text-[13px] text-body">{field}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-muted">{limit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
