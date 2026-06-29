"use client";

/* eslint-disable @next/next/no-img-element -- small inlined brand mark from the design import */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/** Imported from claude.ai/design "Top navigation bar redesign" — frosted-glass bar,
 *  brand mark + wordmark, segmented pills with a white indicator that slides under
 *  the active tab. Active tab is route-driven (the indicator slides as you navigate). */
const ACCENT = "#2b86ff";

const LINKS = [
  { label: "POC", href: "/", match: (p: string) => p === "/" || p.startsWith("/improve") },
  { label: "API", href: "/api-playground", match: (p: string) => p.startsWith("/api-playground") },
  { label: "API Reference", href: "/api-docs", match: (p: string) => p.startsWith("/api-docs") },
] as const;

interface Indicator {
  left: number;
  width: number;
  top: number;
  height: number;
  ready: boolean;
}

export default function TopNav() {
  const pathname = usePathname();
  const activeIndex = Math.max(
    0,
    LINKS.findIndex((l) => l.match(pathname)),
  );
  const trackRef = useRef<HTMLElement | null>(null);
  const pillRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const [ind, setInd] = useState<Indicator>({ left: 0, width: 0, top: 0, height: 0, ready: false });
  const [hover, setHover] = useState(-1);

  useEffect(() => {
    const measure = () => {
      const track = trackRef.current;
      const el = pillRefs.current[activeIndex];
      if (!track || !el) return;
      const tr = track.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      setInd((cur) => {
        const next = { left: r.left - tr.left, width: r.width, top: r.top - tr.top, height: r.height, ready: true };
        const changed =
          !cur.ready ||
          Math.abs(cur.left - next.left) > 0.5 ||
          Math.abs(cur.width - next.width) > 0.5 ||
          Math.abs(cur.top - next.top) > 0.5 ||
          Math.abs(cur.height - next.height) > 0.5;
        return changed ? next : cur;
      });
    };
    measure();
    window.addEventListener("resize", measure);
    // re-measure across a few frames while fonts/layout settle
    const timers = [60, 180, 400].map((t) => window.setTimeout(measure, t));
    if (typeof document !== "undefined" && document.fonts?.ready) {
      document.fonts.ready.then(measure).catch(() => {});
    }
    return () => {
      window.removeEventListener("resize", measure);
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, [activeIndex, pathname]);

  return (
    <header style={{ position: "sticky", top: 0, zIndex: 30 }}>
      <div
        style={{
          height: 64,
          background: "rgba(255,255,255,0.78)",
          backdropFilter: "saturate(180%) blur(16px)",
          WebkitBackdropFilter: "saturate(180%) blur(16px)",
          borderBottom: "1px solid rgba(20,22,27,0.07)",
          boxShadow: "0 1px 0 rgba(255,255,255,0.7) inset, 0 6px 24px -16px rgba(20,30,60,0.30)",
        }}
      >
        <div
          style={{
            maxWidth: 1500,
            margin: "0 auto",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 24,
            padding: "0 28px",
          }}
        >
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: 11, textDecoration: "none", flexShrink: 0 }}>
            <img src="/naxai-mark.png" alt="Naxai" style={{ height: 30, width: "auto", display: "block" }} />
            <span style={{ display: "flex", flexDirection: "column", lineHeight: 1, gap: 5 }}>
              <span style={{ fontWeight: 700, fontSize: 16, letterSpacing: "-0.02em", color: "#14161b" }}>Naxai</span>
              <span
                style={{
                  fontFamily: "var(--font-int-mono), monospace",
                  fontWeight: 600,
                  fontSize: 9.5,
                  letterSpacing: "0.24em",
                  textTransform: "uppercase",
                  color: "#9aa0ac",
                }}
              >
                {"RCS Lab"}
              </span>
            </span>
          </Link>

          <nav
            aria-label="Primary"
            ref={trackRef}
            style={{
              position: "relative",
              display: "flex",
              alignItems: "center",
              gap: 4,
              padding: 5,
              borderRadius: 14,
              background: "rgba(20,30,60,0.045)",
              border: "1px solid rgba(20,22,27,0.05)",
              boxShadow: "0 1px 1px rgba(20,30,60,0.03) inset",
            }}
          >
            <span
              aria-hidden
              style={
                ind.ready
                  ? {
                      position: "absolute",
                      zIndex: 0,
                      pointerEvents: "none",
                      left: ind.left,
                      width: ind.width,
                      top: ind.top,
                      height: ind.height,
                      borderRadius: 10,
                      background: "#ffffff",
                      boxShadow:
                        "0 2px 8px -2px rgba(20,30,60,0.18), 0 1px 0 rgba(255,255,255,0.9) inset, 0 0 0 1px rgba(20,22,27,0.04)",
                      transition: "left .32s cubic-bezier(.5,.05,.2,1), width .32s cubic-bezier(.5,.05,.2,1)",
                    }
                  : { position: "absolute", opacity: 0, pointerEvents: "none" }
              }
            />
            {LINKS.map((l, idx) => {
              const isActive = idx === activeIndex;
              const isHover = idx === hover && !isActive;
              const color = isActive ? ACCENT : isHover ? "#2b2f38" : "#7b818d";
              return (
                <Link
                  key={l.label}
                  href={l.href}
                  ref={(el) => {
                    pillRefs.current[idx] = el;
                  }}
                  aria-current={isActive ? "page" : undefined}
                  onMouseEnter={() => setHover(idx)}
                  onMouseLeave={() => setHover(-1)}
                  style={{
                    position: "relative",
                    zIndex: 1,
                    display: "flex",
                    alignItems: "center",
                    height: 34,
                    padding: "0 16px",
                    borderRadius: 10,
                    fontSize: 13.5,
                    fontWeight: 600,
                    letterSpacing: "-0.01em",
                    whiteSpace: "nowrap",
                    textDecoration: "none",
                    color,
                    transition: "color .18s ease",
                  }}
                >
                  {l.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </header>
  );
}
