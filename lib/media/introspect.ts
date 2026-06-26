/**
 * Pure media introspection: bytes in → MediaIntrospection out. No I/O, so it
 * runs identically in the browser (uploads) and the server route (URL fetch).
 *
 * Images: dimensions via `image-size` (header bytes). Video: header-only —
 * type + size, no dimension parsing (no guide rule needs video dimensions).
 */

import { imageSize } from "image-size";
import type { MediaIntrospection } from "@/types/rcs";

export function introspectMedia(
  bytes: Uint8Array,
  headers: { contentType: string; fileSizeBytes: number; thumbnailSizeBytes?: number },
): MediaIntrospection {
  const mimeType = headers.contentType.split(";")[0].trim().toLowerCase();
  const base = {
    mimeType,
    fileSizeBytes: headers.fileSizeBytes,
    thumbnailSizeBytes: headers.thumbnailSizeBytes,
  };
  if (mimeType.startsWith("video/")) {
    return { mediaType: "video", ...base };
  }
  const { width, height } = imageSize(bytes);
  return {
    mediaType: "image",
    ...base,
    width,
    height,
    aspectRatio: width && height ? width / height : undefined,
  };
}
