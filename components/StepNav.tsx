"use client";

/**
 * Wizard navigation: 1 Draft → 2 Playbook Pass → 3 LLM Enhanced → 4 Agent Enhanced.
 * A compact, contained segmented stepper that sits left-aligned below the page
 * title. Steps 3 and 4 are future phases — visible but disabled.
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

function Chevron() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className="h-3.5 w-3.5 shrink-0 text-faint"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

export default function StepNav() {
  const pathname = usePathname();
  const activeIndex = pathname === "/improve" ? 1 : 0;

  return (
    <nav aria-label="Workflow steps" className="mt-6">
      <ol className="flex flex-wrap items-center gap-x-1 gap-y-2">
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
              "border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-[var(--color-primary)]",
            done: "border-line bg-panel text-body hover:border-[var(--color-secondary)] hover:text-[var(--color-secondary)]",
            idle: "border-line bg-panel text-muted hover:border-line-strong hover:text-body",
            soon: "cursor-not-allowed border-line bg-panel text-muted opacity-50",
          }[state];

          const badgeClass = {
            active: "bg-[var(--color-primary)] text-[var(--color-primary-foreground)]",
            done: "bg-[var(--color-secondary)] text-[var(--color-secondary-foreground)]",
            idle: "border border-line-strong text-muted",
            soon: "border border-line-strong text-muted",
          }[state];

          const pill = (
            <span
              className={`flex items-center gap-2 rounded-full border py-1.5 pl-1.5 pr-3.5 text-sm font-semibold transition ${pillClass}`}
              aria-current={state === "active" ? "step" : undefined}
            >
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-mono text-[11px] font-bold ${badgeClass}`}
              >
                {state === "done" ? "✓" : step.n}
              </span>
              <span className="whitespace-nowrap">{step.label}</span>
              {state === "soon" && (
                <span className="rounded bg-panel-strong px-1.5 py-0.5 font-mono text-[8px] font-bold tracking-widest text-muted">
                  SOON
                </span>
              )}
            </span>
          );

          return (
            <Fragment key={step.n}>
              {i > 0 && (
                <li aria-hidden className="px-0.5">
                  <Chevron />
                </li>
              )}
              <li>
                {step.href !== null && state !== "active" ? (
                  <Link href={step.href} className="block">
                    {pill}
                  </Link>
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
