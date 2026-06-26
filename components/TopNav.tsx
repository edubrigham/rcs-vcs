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
    <header className="sticky top-0 z-30 border-b border-line bg-[var(--background)]">
      <div className="mx-auto flex h-14 w-full max-w-[1500px] items-stretch gap-7 px-5">
        <Link href="/" className="flex items-center gap-2">
          <span className="font-display text-sm font-bold tracking-tight text-heading">Naxai</span>
          <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted">RCS&nbsp;Lab</span>
        </Link>
        <nav aria-label="Primary" className="flex items-stretch gap-1">
          {LINKS.map((l) => {
            const active = l.match(pathname);
            return (
              <Link
                key={l.label}
                href={l.href}
                aria-current={active ? "page" : undefined}
                className={`relative flex items-center px-3 text-sm font-medium transition-colors ${
                  active ? "text-heading" : "text-muted hover:text-body"
                }`}
              >
                {l.label}
                <span
                  className={`absolute inset-x-3 bottom-0 h-0.5 rounded-full ${
                    active ? "bg-[var(--color-primary)]" : "bg-transparent"
                  }`}
                />
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
