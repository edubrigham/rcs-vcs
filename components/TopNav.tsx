"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Primary navigation: the three top-level destinations. */
const LINKS = [
  { label: "POC", href: "/", match: (p: string) => p === "/" || p.startsWith("/improve") },
  { label: "API", href: "/api-playground", match: (p: string) => p.startsWith("/api-playground") },
  { label: "API Reference", href: "/api-docs", match: (p: string) => p.startsWith("/api-docs") },
] as const;

export default function TopNav() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-[var(--background)]/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-[1500px] items-center justify-between px-5">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-2.5" aria-label="Naxai RCS Lab — home">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-primary)] font-display text-sm font-bold text-[var(--color-primary-foreground)] shadow-[0_6px_18px_-8px_var(--color-primary)]">
            N
          </span>
          <span className="flex flex-col leading-none">
            <span className="font-display text-sm font-bold tracking-tight text-heading">Naxai</span>
            <span className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.28em] text-muted">RCS Lab</span>
          </span>
        </Link>

        {/* Segmented pill nav */}
        <nav
          aria-label="Primary"
          className="flex items-center gap-1 rounded-full border border-line bg-panel p-1"
        >
          {LINKS.map((l) => {
            const active = l.match(pathname);
            return (
              <Link
                key={l.label}
                href={l.href}
                aria-current={active ? "page" : undefined}
                className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                  active
                    ? "bg-[var(--color-primary)] text-[var(--color-primary-foreground)] shadow-[0_4px_14px_-6px_var(--color-primary)]"
                    : "text-muted hover:bg-panel-strong hover:text-heading"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
