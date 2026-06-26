"use client";

/**
 * Shared simulator state: the native Naxai card (`StandaloneRichCard`), its
 * derived `MediaIntrospection`, and the simulator-only `FocalPoint`, plus view
 * options. Used by both the editor (/) and the improvement studio (/improve).
 *
 * State survives client-side navigation via React context and hard refreshes
 * via sessionStorage. Uploaded images are blob: URLs that die on reload, so a
 * restored session falls back to the bundled sample.
 */

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import { DEFAULT_CARD, DEFAULT_FOCAL, DEFAULT_MEDIA } from "@/lib/sampleContent";
import type { PlatformVisibility } from "@/components/RcsInputPanel";
import type { FocalPoint, MediaIntrospection, OverlayToggles, StandaloneRichCard } from "@/types/rcs";

interface SimulatorState {
  card: StandaloneRichCard;
  media: MediaIntrospection | undefined;
  focal: FocalPoint;
  setCard: Dispatch<SetStateAction<StandaloneRichCard>>;
  setMedia: Dispatch<SetStateAction<MediaIntrospection | undefined>>;
  setFocal: Dispatch<SetStateAction<FocalPoint>>;
  replaceAll: (next: { card: StandaloneRichCard; media: MediaIntrospection | undefined; focal: FocalPoint }) => void;
  toggles: OverlayToggles;
  setToggles: (toggles: OverlayToggles) => void;
  platforms: PlatformVisibility;
  setPlatforms: (platforms: PlatformVisibility) => void;
}

const STORAGE_KEY = "rcs-sim-state-v2";

const SimulatorContext = createContext<SimulatorState | null>(null);

export function SimulatorProvider({ children }: { children: ReactNode }) {
  const [card, setCard] = useState<StandaloneRichCard>(DEFAULT_CARD);
  const [media, setMedia] = useState<MediaIntrospection | undefined>(DEFAULT_MEDIA);
  const [focal, setFocal] = useState<FocalPoint>(DEFAULT_FOCAL);
  const [toggles, setToggles] = useState<OverlayToggles>({
    showSafeZone: true,
    showCropArea: false,
    showTextLineLimits: true,
  });
  const [platforms, setPlatforms] = useState<PlatformVisibility>({ ios: true, android: true });
  const restored = useRef(false);

  // Restore once after mount — sessionStorage doesn't exist during SSR.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved.card) {
          const fileUrl = (saved.card as StandaloneRichCard).cardContent.media?.contentInfo.fileUrl;
          if (!fileUrl || fileUrl.startsWith("blob:") || !saved.media) {
            // Uploaded images are blob: URLs that die on reload — fall back to the
            // bundled sample so a restored session never renders empty.
            setCard(DEFAULT_CARD);
            setMedia(DEFAULT_MEDIA);
            setFocal(DEFAULT_FOCAL);
          } else {
            setCard(saved.card);
            setMedia(saved.media);
            if (saved.focal) setFocal(saved.focal);
          }
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
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ card, media, focal, toggles, platforms }));
    } catch {
      // storage full/unavailable — state simply won't survive a refresh
    }
  }, [card, media, focal, toggles, platforms]);

  const value: SimulatorState = {
    card,
    media,
    focal,
    setCard,
    setMedia,
    setFocal,
    replaceAll: ({ card: c, media: m, focal: f }) => {
      setCard(c);
      setMedia(m);
      setFocal(f);
    },
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
