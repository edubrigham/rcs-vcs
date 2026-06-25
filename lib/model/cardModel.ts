import type { CardFormat, CardOrientation, MediaHeight } from "@/types/rcs";

export function cardFormatToOrientationHeight(cf: CardFormat): {
  orientation: CardOrientation;
  mediaHeight: MediaHeight | null;
} {
  switch (cf) {
    case "compact": return { orientation: "HORIZONTAL", mediaHeight: null };
    case "medium":  return { orientation: "VERTICAL", mediaHeight: "MEDIUM" };
    case "tall":    return { orientation: "VERTICAL", mediaHeight: "TALL" };
  }
}
