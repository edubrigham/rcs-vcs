"use client";

import { useEffect, useRef } from "react";
import "swagger-ui-dist/swagger-ui.css";

/**
 * Classic Swagger UI "try it" page for the scoring API. Mounts the
 * framework-agnostic swagger-ui-dist ESM bundle (no React-version coupling)
 * against a div, pointed at the generated /api/openapi.json. The bundle is
 * dynamically imported inside the effect so it loads in the browser only (it
 * touches window/document at module eval). Disposable shell.
 */
export default function ApiDocsPage() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const mod = await import("swagger-ui-dist/swagger-ui-es-bundle.js");
      const SwaggerUIBundle = (mod.default ?? mod) as (options: Record<string, unknown>) => unknown;
      if (cancelled || !ref.current) return;
      SwaggerUIBundle({
        url: "/api/openapi",
        domNode: ref.current,
        deepLinking: true,
        tryItOutEnabled: true,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="mx-auto w-full max-w-[1100px] px-5 py-8">
      <h1 className="font-display mb-4 text-2xl font-bold text-heading">RCS Scoring API — try it</h1>
      <p className="mb-4 text-sm text-muted">
        Two axes over a Naxai <code className="font-mono text-xs">standaloneRichCard</code>: functional
        compliance (would the sendRCS API accept it) and quality (iOS vs Android). Expand{" "}
        <code className="font-mono text-xs">POST /analyze</code>, &ldquo;Try it out&rdquo;, Execute.
      </p>
      <div ref={ref} className="rounded-xl bg-white p-2" />
    </main>
  );
}
