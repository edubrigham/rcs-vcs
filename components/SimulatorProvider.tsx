"use client";

/**
 * Shared simulator state: the authored card content plus view options, used by
 * both the editor (/) and the improvement studio (/improve).
 *
 * State survives client-side navigation via React context and hard refreshes
 * via sessionStorage. Uploaded images are blob: URLs that die on reload, so a
 * restored session drops them gracefully (the data-URI sample survives).
 */

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { DEFAULT_CONTENT } from "@/lib/sampleContent";
import type { PlatformVisibility } from "@/components/RcsInputPanel";
import type { OverlayToggles, RcsContent } from "@/types/rcs";

interface SimulatorState {
  content: RcsContent;
  patchContent: (patch: Partial<RcsContent>) => void;
  replaceContent: (content: RcsContent) => void;
  toggles: OverlayToggles;
  setToggles: (toggles: OverlayToggles) => void;
  platforms: PlatformVisibility;
  setPlatforms: (platforms: PlatformVisibility) => void;
}

const STORAGE_KEY = "rcs-sim-state-v1";

const SimulatorContext = createContext<SimulatorState | null>(null);

export function SimulatorProvider({ children }: { children: ReactNode }) {
  const [content, setContent] = useState<RcsContent>(DEFAULT_CONTENT);
  const [toggles, setToggles] = useState<OverlayToggles>({
    showSafeZone: true,
    showCropArea: false,
    showTextLineLimits: true,
  });
  const [platforms, setPlatforms] = useState<PlatformVisibility>({
    ios: true,
    android: true,
  });
  const restored = useRef(false);

  // Restore once after mount — sessionStorage doesn't exist during SSR, and
  // reading it in the initial state would cause a hydration mismatch, so the
  // one-time post-mount setState here is intentional.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved.content) {
          const savedContent = saved.content as RcsContent;
          if (
            !savedContent.imageUrl ||
            savedContent.imageUrl.startsWith("blob:") ||
            !savedContent.imageMetadata
          ) {
            // Uploaded images are blob: URLs that die on reload (and older
            // saves may carry a dropped/imageless state). Fall back to the
            // bundled sample so a restored session never renders empty —
            // the user can simply re-upload their file.
            savedContent.imageUrl = DEFAULT_CONTENT.imageUrl;
            savedContent.imageMetadata = DEFAULT_CONTENT.imageMetadata;
            savedContent.focalPoint = DEFAULT_CONTENT.focalPoint;
          }
          setContent(savedContent);
        }
        if (saved.toggles) setToggles(saved.toggles);
        if (saved.platforms) setPlatforms(saved.platforms);
      }
    } catch {
      // corrupt/unavailable storage — start from defaults
    }
    restored.current = true;
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (!restored.current) return;
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ content, toggles, platforms }));
    } catch {
      // storage full/unavailable — state simply won't survive a refresh
    }
  }, [content, toggles, platforms]);

  const value: SimulatorState = {
    content,
    patchContent: (patch) => setContent((prev) => ({ ...prev, ...patch })),
    replaceContent: setContent,
    toggles,
    setToggles,
    platforms,
    setPlatforms,
  };

  return <SimulatorContext.Provider value={value}>{children}</SimulatorContext.Provider>;
}

export function useSimulator(): SimulatorState {
  const ctx = useContext(SimulatorContext);
  if (!ctx) {
    throw new Error("useSimulator must be used inside <SimulatorProvider>");
  }
  return ctx;
}
