"use client";

/**
 * Phase 2 — Playbook Pass: deterministic playbook fixes applied to the card
 * authored on the Draft page, shown as a before/after.
 *
 * The kernel runs on the native Naxai model; this disposable shell uses the
 * `CardView` presentation model (see components/cardView.ts).
 */

import { useRouter } from "next/navigation";
import { useMemo } from "react";
import BeforeAfterComparison from "@/components/BeforeAfterComparison";
import { cardToView, viewToParts, type CardView } from "@/components/cardView";
import ChangesPanel from "@/components/ChangesPanel";
import ImprovementScorePanel from "@/components/ImprovementScorePanel";
import PreviewToolbar from "@/components/PreviewToolbar";
import { useSimulator } from "@/components/SimulatorProvider";
import StepNav from "@/components/StepNav";
import { improveRcsContent } from "@/lib/improveRcsContent";
import { scoreRcsContent } from "@/lib/scoreRcsContent";
import type { Platform } from "@/types/rcs";

export default function ImprovePage() {
  const router = useRouter();
  const { card, media, focal, replaceAll, setCard, setMedia, setFocal, toggles, setToggles, platforms, setPlatforms } =
    useSimulator();

  const view = useMemo(() => cardToView(card, media, focal), [card, media, focal]);
  const score = useMemo(() => scoreRcsContent(card, media, focal), [card, media, focal]);
  const improved = useMemo(() => improveRcsContent(card, media, focal, score), [card, media, focal, score]);
  const improvedScore = useMemo(
    () => scoreRcsContent(improved.improvedContent, improved.improvedMedia, improved.improvedFocal),
    [improved],
  );

  // Playbook Pass shows ONE platform at a time; derive it from the shared state.
  const activePlatform: Platform = platforms.android && !platforms.ios ? "android" : "ios";
  const singlePlatform = { ios: activePlatform === "ios", android: activePlatform === "android" };

  const onContentChange = (patch: Partial<CardView>) => {
    const parts = viewToParts({ ...view, ...patch }, media);
    setCard(parts.card);
    setMedia(parts.media);
    setFocal(parts.focal);
  };

  function saveChanges() {
    replaceAll({ card: improved.improvedContent, media: improved.improvedMedia, focal: improved.improvedFocal });
    router.push("/");
  }

  return (
    <main className="mx-auto w-full max-w-[1500px] px-5 pb-24 pt-8">
      {/* ── Header: title + step nav (no action button — Save lives in the viewport) ── */}
      <header className="mb-8 border-b border-line pb-6">
        <h1 className="font-display text-3xl font-bold tracking-tight text-heading sm:text-4xl">
          RCS Visual Compatibility Simulator
        </h1>
        <StepNav />
      </header>

      <div className="grid items-start gap-8 lg:grid-cols-[minmax(330px,390px)_1fr]">
        <aside className="flex flex-col gap-4">
          <ImprovementScorePanel before={score} after={improvedScore} />
          <ChangesPanel changes={improved.changes} />
        </aside>

        <div className="overflow-hidden rounded-2xl border border-line bg-[radial-gradient(ellipse_at_top,rgba(56,130,246,0.08),transparent_60%)]">
          <PreviewToolbar
            orientation={view.orientation}
            height={view.height}
            onOrientationChange={(orientation) => onContentChange({ orientation })}
            onHeightChange={(height) => onContentChange({ height })}
            platformMode="single"
            platforms={platforms}
            onPlatformsChange={setPlatforms}
            toggles={toggles}
            onTogglesChange={setToggles}
          />
          <div className="relative p-6 pb-2">
            <BeforeAfterComparison
              original={view}
              originalScore={score}
              improved={improved}
              improvedScore={improvedScore}
              toggles={toggles}
              platforms={singlePlatform}
            />
            {/* Save changes — bottom-right, aligned with the device bottom */}
            <button
              type="button"
              onClick={saveChanges}
              className="absolute bottom-2 right-6 rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-white shadow-[0_8px_24px_-10px_rgba(14,165,233,0.7)] transition hover:opacity-90 active:scale-[0.98]"
            >
              Save changes
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
