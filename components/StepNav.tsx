"use client";

/**
 * Wizard navigation: 1 Setup → 2 Improve → 3 AI Improve.
 * Sits on its own centered row (~2/3 width) below the page title.
 * Step 3 is the future Anthropic Agent SDK phase — visible but disabled.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment } from "react";

const STEPS = [
  { n: 1, label: "Setup", href: "/" },
  { n: 2, label: "Improve", href: "/improve" },
  { n: 3, label: "AI Improve", href: null },
] as const;

export default function StepNav() {
  const pathname = usePathname();
  const activeIndex = pathname === "/improve" ? 1 : 0;

  return (
    <nav aria-label="Workflow steps" className="mt-5 flex justify-center">
      <ol className="flex w-full items-center md:w-2/3">
        {STEPS.map((step, i) => {
          const state =
            step.href === null
              ? "soon"
              : i === activeIndex
                ? "active"
                : i < activeIndex
                  ? "done"
                  : "idle";

          const pillClass = {
            active: "border-sky-500/60 bg-sky-500/10 text-sky-800",
            done: "border-emerald-600/40 text-emerald-700 hover:border-emerald-600/70",
            idle: "border-line bg-panel text-muted hover:border-line-strong",
            soon: "cursor-not-allowed border-line bg-panel text-muted opacity-45",
          }[state];

          const numberClass = {
            active: "border-sky-500 bg-sky-500 text-white",
            done: "border-emerald-600 text-emerald-600",
            idle: "border-line-strong text-muted",
            soon: "border-line-strong text-muted",
          }[state];

          const pill = (
            <span
              className={`flex w-full items-center justify-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition ${pillClass}`}
              aria-current={state === "active" ? "step" : undefined}
            >
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border font-mono text-[11px] font-bold ${numberClass}`}
              >
                {state === "done" ? "✓" : step.n}
              </span>
              {step.label}
              {state === "soon" && (
                <span className="rounded bg-panel-strong px-1.5 py-0.5 font-mono text-[8px] font-bold tracking-widest">
                  SOON
                </span>
              )}
            </span>
          );

          return (
            <Fragment key={step.n}>
              {i > 0 && <span aria-hidden className="h-px w-7 shrink-0 bg-line-strong" />}
              <li className="min-w-0 flex-1">
                {step.href !== null && state !== "active" ? (
                  <Link href={step.href}>{pill}</Link>
                ) : (
                  pill
                )}
              </li>
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}
