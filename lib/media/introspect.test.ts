import { describe, it, expect } from "vitest";
import { introspectMedia } from "@/lib/media/introspect";

// 1×1 PNG, base64-decoded to bytes.
const PNG_1x1 = Uint8Array.from(
  atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="),
  (c) => c.charCodeAt(0),
);

describe("introspectMedia", () => {
  it("reads PNG dimensions from header bytes", () => {
    const m = introspectMedia(PNG_1x1, { contentType: "image/png", fileSizeBytes: 67 });
    expect(m).toMatchObject({
      mediaType: "image",
      mimeType: "image/png",
      width: 1,
      height: 1,
      aspectRatio: 1,
      fileSizeBytes: 67,
    });
  });

  it("treats video as header-only (type + size, no dimensions)", () => {
    const m = introspectMedia(new Uint8Array(0), { contentType: "video/mp4; codecs=avc1", fileSizeBytes: 5_000_000 });
    expect(m).toEqual({
      mediaType: "video",
      mimeType: "video/mp4",
      fileSizeBytes: 5_000_000,
      thumbnailSizeBytes: undefined,
    });
    expect(m.width).toBeUndefined();
  });

  it("lowercases and strips parameters from the content-type", () => {
    const m = introspectMedia(PNG_1x1, { contentType: "IMAGE/PNG", fileSizeBytes: 67 });
    expect(m.mimeType).toBe("image/png");
  });
});
