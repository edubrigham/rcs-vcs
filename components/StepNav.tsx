"use client";

/**
 * Wizard navigation: 1 Draft → 2 Playbook Pass → 3 LLM Enhanced → 4 Agent Enhanced.
 * Sits on its own centered row (~2/3 width) below the page title.
 * Step 3 is the future Anthropic Agent SDK phase — visible but disabled.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment } from "react";

const STEPS = [
  { n: 1, label: "Draft", href: "/" },
  { n: 2, label: "Playbook Pass", href: "/improve" },
  { n: 3, label: "LLM Enhanced", href: null },
  { n: 4, label: "Agent Enhanced", href: null },
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
            active:
              "border-[var(--color-primary)] bg-panel-strong text-[var(--color-primary)]",
            done: "border-[var(--color-secondary)] text-[var(--color-secondary)] hover:bg-panel-strong",
            idle: "border-line bg-panel text-muted hover:border-line-strong",
            soon: "cursor-not-allowed border-line bg-panel text-muted opacity-45",
          }[state];

          const numberClass = {
            active: "border-[var(--color-primary)] bg-[var(--color-primary)] text-white",
            done: "border-[var(--color-secondary)] text-[var(--color-secondary)]",
            idle: "border-line-strong text-muted",
            soon: "border-line-strong text-muted",
          }[state];

          const pill = (
            <span
              className={`flex w-full items-center justify-center gap-2 rounded-full border px-4 py-4 text-sm font-semibold transition ${pillClass}`}
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
