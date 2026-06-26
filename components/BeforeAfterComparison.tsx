"use client";

/**
 * Before→After device grid for the Playbook Pass page. Original | Improved
 * columns, one row per active platform (driven by the toolbar toggles). Uses
 * the same full-size device frames as the Draft page. The score and the changes
 * list live in the page sidebar, not here.
 */

import { scoreTone } from "@/components/ScorePanel";
import { cardToView, suggestionsToViews, type CardView } from "@/components/cardView";
import PlatformPreview from "@/components/PlatformPreview";
import RcsCardPreview from "@/components/RcsCardPreview";
import type { PlatformVisibility } from "@/components/RcsInputPanel";
import type {
  ImprovedRcsContent,
  OverlayToggles,
  Platform,
  ScoreResult,
} from "@/types/rcs";

interface BeforeAfterComparisonProps {
  original: CardView;
  originalScore: ScoreResult;
  improved: ImprovedRcsContent;
  improvedScore: ScoreResult;
  toggles: OverlayToggles;
  platforms: PlatformVisibility;
}

/** Corner-badge content: "Original"/"Improved" + score (+ delta). */
function CornerBadge({ label, value, delta }: { label: string; value: number; delta?: number }) {
  const deltaText =
    delta === undefined ? undefined : delta > 0 ? `+${delta}` : `${delta}`;

  return (
    <>
      <span className="font-semibold uppercase tracking-[0.1em] text-muted">{label}</span>
      {delta === undefined ? (
        <span className={`font-bold ${scoreTone(value)}`}>{value}</span>
      ) : (
        <>
          <span
            className={
              delta > 0
                ? "text-[var(--color-secondary)]"
                : delta < 0
                  ? "text-[var(--color-destructive)]"
                  : "text-muted"
            }
          >
            {deltaText}
          </span>
          <span className="font-bold text-faint"> ({value})</span>
        </>
      )}
    </>
  );
}

export default function BeforeAfterComparison({
  original,
  originalScore,
  improved,
  improvedScore,
  toggles,
  platforms,
}: BeforeAfterComparisonProps) {
  const improvedView = cardToView(improved.improvedContent, improved.improvedMedia, improved.improvedFocal);
  const platformScore = (score: ScoreResult, platform: Platform) =>
    platform === "ios" ? score.iosScore : score.androidScore;
  const active = (["ios", "android"] as const).filter((p) => platforms[p]);
  const label = (p: Platform) => (p === "ios" ? "iOS" : "Android");

  if (active.length === 0) {
    return (
      <p className="py-20 text-center text-sm text-muted">
        Enable at least one platform in the toolbar above.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-10">
      {active.map((platform) => (
        // Same container as the Draft preview area (flex, centered, gap-8) so the
        // device frames land in the exact same spot when switching pages.
        <div key={platform} className="flex flex-wrap items-start justify-center gap-8">
          <PlatformPreview
            platform={platform}
            caption={label(platform)}
            cornerSide="left"
            corner={<CornerBadge label="Original" value={platformScore(originalScore, platform)} />}
          >
            <RcsCardPreview content={original} platform={platform} toggles={toggles} variant="original" />
          </PlatformPreview>

          <PlatformPreview
            platform={platform}
            caption={label(platform)}
            cornerSide="right"
            corner={
              <CornerBadge
                label="Improved"
                value={platformScore(improvedScore, platform)}
                delta={platformScore(improvedScore, platform) - platformScore(originalScore, platform)}
              />
            }
          >
            <RcsCardPreview
              content={improvedView}
              platform={platform}
              toggles={toggles}
              variant="improved"
              subjectPoint={original.focalPoint}
              secondaryActions={suggestionsToViews(improved.secondaryActions)}
            />
          </PlatformPreview>
        </div>
      ))}
    </div>
  );
}
