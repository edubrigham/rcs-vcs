"use client";

/**
 * Phase 1 — the visual simulator: author a card, see iOS/Android side by
 * side, get the deterministic compatibility score.
 *
 * The kernel runs on the native Naxai model; this disposable shell uses the
 * `CardView` presentation model (see components/cardView.ts).
 */

import { useMemo } from "react";
import { cardToView, viewToParts, type CardView } from "@/components/cardView";
import PlatformPreview from "@/components/PlatformPreview";
import PreviewToolbar from "@/components/PreviewToolbar";
import RcsCardPreview from "@/components/RcsCardPreview";
import FunctionalBanner from "@/components/FunctionalBanner";
import RcsInputPanel from "@/components/RcsInputPanel";
import ScorePanel from "@/components/ScorePanel";
import { useSimulator } from "@/components/SimulatorProvider";
import StepNav from "@/components/StepNav";
import { scoreRcsContent } from "@/lib/scoreRcsContent";
import { validateFunctional } from "@/lib/validateFunctional";
import type { MediaIntrospection } from "@/types/rcs";

export default function Home() {
  const { card, media, focal, setCard, setMedia, setFocal, toggles, setToggles } = useSimulator();

  const view = useMemo(() => cardToView(card, media, focal), [card, media, focal]);
  const score = useMemo(() => scoreRcsContent(card, media, focal), [card, media, focal]);
  const functional = useMemo(() => validateFunctional(card, media), [card, media]);

  const onContentChange = (patch: Partial<CardView>) => {
    const parts = viewToParts({ ...view, ...patch }, media);
    setCard(parts.card);
    setMedia(parts.media);
    setFocal(parts.focal);
  };

  const onMediaUrlFetched = (url: string, fetched: MediaIntrospection) => {
    // Write native state directly — the CardView round-trip would drop the
    // introspected mime/size/type, keeping only width/height/aspect.
    setCard({
      ...card,
      cardContent: {
        ...card.cardContent,
        media: { height: card.cardContent.media?.height ?? "TALL", contentInfo: { fileUrl: url } },
      },
    });
    setMedia(fetched);
    setFocal({ x: 0.5, y: 0.5 });
  };

  return (
    <main className="mx-auto w-full max-w-[1500px] px-5 pb-24 pt-8">
      {/* ── Header: title row + centered step navigation ── */}
      <header className="mb-8 border-b border-line pb-6">
        <div className="flex items-center justify-between">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-accent">
            Naxai · RCS Lab
          </p>
          <div className="flex items-center gap-4">
            <a href="/api-playground" className="font-mono text-[11px] text-muted transition hover:text-body">
              API playground
            </a>
            <a href="/api-docs" className="font-mono text-[11px] text-accent hover:underline">
              API docs ↗
            </a>
          </div>
        </div>
        <h1 className="font-display mt-1 text-3xl font-bold tracking-tight text-heading sm:text-4xl">
          RCS Visual Compatibility Simulator
        </h1>

        <StepNav />
      </header>

      {/* ── Editor + previews ── */}
      <div className="grid gap-8 lg:grid-cols-[minmax(330px,390px)_1fr]">
        <RcsInputPanel content={view} onContentChange={onContentChange} onMediaUrlFetched={onMediaUrlFetched} toggles={toggles} />

        <div className="flex flex-col gap-8">
          <div className="overflow-hidden rounded-2xl border border-line bg-[radial-gradient(ellipse_at_top,rgba(56,130,246,0.08),transparent_60%)]">
            <PreviewToolbar
              orientation={view.orientation}
              height={view.height}
              onOrientationChange={(orientation) => onContentChange({ orientation })}
              onHeightChange={(height) => onContentChange({ height })}
              toggles={toggles}
              onTogglesChange={setToggles}
            />

            {/* Draft always shows BOTH platforms side by side — the tool's
                signature comparison; no device filter here. */}
            <div className="flex flex-wrap items-start justify-center gap-8 p-6 pb-2">
              <PlatformPreview platform="ios" caption="iOS">
                <RcsCardPreview content={view} platform="ios" toggles={toggles} />
              </PlatformPreview>
              <PlatformPreview platform="android" caption="Android">
                <RcsCardPreview content={view} platform="android" toggles={toggles} />
              </PlatformPreview>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <FunctionalBanner result={functional} />
            <ScorePanel score={score} />
          </div>
        </div>
      </div>
    </main>
  );
}
