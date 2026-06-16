"use client";

/**
 * Before→After device grid for the Playbook Pass page. Original | Improved
 * columns, one row per active platform (driven by the toolbar toggles). Uses
 * the same full-size device frames as the Draft page. The score and the changes
 * list live in the page sidebar, not here.
 */

import { scoreTone } from "@/components/ScorePanel";
import PlatformPreview from "@/components/PlatformPreview";
import RcsCardPreview from "@/components/RcsCardPreview";
import type { PlatformVisibility } from "@/components/RcsInputPanel";
import type {
  ImprovedRcsContent,
  OverlayToggles,
  Platform,
  RcsContent,
  ScoreResult,
} from "@/types/rcs";

interface BeforeAfterComparisonProps {
  original: RcsContent;
  originalScore: ScoreResult;
  improved: ImprovedRcsContent;
  improvedScore: ScoreResult;
  toggles: OverlayToggles;
  platforms: PlatformVisibility;
}

/** Below-device label: "Original"/"Improved" + score chip (+ delta). */
function Footer({ label, value, delta }: { label: string; value: number; delta?: number }) {
  return (
    <>
      <span className="font-mono text-[12px] font-semibold tracking-[0.15em] text-muted">{label}</span>
      <span className="flex items-center gap-1.5 rounded-full border border-line bg-field px-2 py-0.5 font-mono text-[11px]">
        <span className={`font-semibold ${scoreTone(value)}`}>{value}</span>
        {delta !== undefined && delta !== 0 && (
          <span className={delta > 0 ? "text-[var(--color-secondary)]" : "text-[var(--color-destructive)]"}>
            {delta > 0 ? `▲ +${delta}` : `▼ ${delta}`}
          </span>
        )}
      </span>
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
            footer={<Footer label="Original" value={platformScore(originalScore, platform)} />}
          >
            <RcsCardPreview content={original} platform={platform} toggles={toggles} variant="original" />
          </PlatformPreview>

          <PlatformPreview
            platform={platform}
            caption={label(platform)}
            footer={
              <Footer
                label="Improved"
                value={platformScore(improvedScore, platform)}
                delta={platformScore(improvedScore, platform) - platformScore(originalScore, platform)}
              />
            }
          >
            <RcsCardPreview
              content={improved.improvedContent}
              platform={platform}
              toggles={toggles}
              variant="improved"
              subjectPoint={original.focalPoint}
              secondaryActions={improved.secondaryActions}
            />
          </PlatformPreview>
        </div>
      ))}
    </div>
  );
}
