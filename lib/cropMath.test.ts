import { describe, expect, it } from "vitest";
import {
  clamp,
  criticalSquareWindow,
  focalInContainer,
  getVisibleWindow,
  pointInWindow,
  subjectProminenceWindow,
  visibleAreaFraction,
} from "@/lib/cropMath";

describe("clamp", () => {
  it("bounds a value to [min, max]", () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-3, 0, 10)).toBe(0);
    expect(clamp(99, 0, 10)).toBe(10);
  });
});

describe("getVisibleWindow (object-fit: cover geometry)", () => {
  it("returns the full image when aspects match", () => {
    expect(getVisibleWindow(1, 1)).toEqual({ x0: 0, y0: 0, x1: 1, y1: 1 });
  });

  it("crops the WIDTH when the image is wider than the container", () => {
    // image 2:1 into a 1:1 container → keep middle 50% of width, full height.
    expect(getVisibleWindow(2, 1)).toEqual({ x0: 0.25, y0: 0, x1: 0.75, y1: 1 });
  });

  it("crops the HEIGHT when the image is taller than the container", () => {
    // image 1:2 (aspect 0.5) into a 1:1 container → full width, middle 50% height.
    expect(getVisibleWindow(0.5, 1)).toEqual({ x0: 0, y0: 0.25, x1: 1, y1: 0.75 });
  });

  it("honours object-position when cropping", () => {
    // top-anchored vertical crop keeps the top of the image.
    expect(getVisibleWindow(0.5, 1, 0.5, 0)).toEqual({ x0: 0, y0: 0, x1: 1, y1: 0.5 });
  });
});

describe("visibleAreaFraction", () => {
  it("is 1.0 for an uncropped window and 0.5 for a half-cropped one", () => {
    expect(visibleAreaFraction({ x0: 0, y0: 0, x1: 1, y1: 1 })).toBe(1);
    expect(visibleAreaFraction({ x0: 0.25, y0: 0, x1: 0.75, y1: 1 })).toBe(0.5);
  });
});

describe("criticalSquareWindow (centered 1:1 area)", () => {
  it("is a centered vertical strip for a landscape image", () => {
    expect(criticalSquareWindow(2)).toEqual({ x0: 0.25, y0: 0, x1: 0.75, y1: 1 });
  });

  it("is a centered horizontal band for a portrait image", () => {
    expect(criticalSquareWindow(0.5)).toEqual({ x0: 0, y0: 0.25, x1: 1, y1: 0.75 });
  });

  it("is the whole image when already square", () => {
    expect(criticalSquareWindow(1)).toEqual({ x0: 0, y0: 0, x1: 1, y1: 1 });
  });
});

describe("subjectProminenceWindow (improved re-crop)", () => {
  it("zooms to 75% of the cover window, centred on the focal point", () => {
    const w = subjectProminenceWindow(1, 1, { x: 0.5, y: 0.5 });
    expect(w).toEqual({ x0: 0.125, y0: 0.125, x1: 0.875, y1: 0.875 });
  });

  it("clamps the window to stay inside the image for an edge focal point", () => {
    const w = subjectProminenceWindow(1, 1, { x: 0, y: 0 });
    expect(w).toEqual({ x0: 0, y0: 0, x1: 0.75, y1: 0.75 });
  });
});

describe("pointInWindow", () => {
  const win = { x0: 0.25, y0: 0, x1: 0.75, y1: 1 };
  it("detects inside vs outside", () => {
    expect(pointInWindow({ x: 0.5, y: 0.5 }, win)).toBe(true);
    expect(pointInWindow({ x: 0.1, y: 0.5 }, win)).toBe(false);
  });
});

describe("focalInContainer", () => {
  const win = { x0: 0.25, y0: 0, x1: 0.75, y1: 1 };
  it("maps a focal point into container space and flags visibility", () => {
    expect(focalInContainer({ x: 0.5, y: 0.5 }, win)).toMatchObject({ u: 0.5, v: 0.5, visible: true });
    expect(focalInContainer({ x: 0.1, y: 0.5 }, win).visible).toBe(false);
  });
});
