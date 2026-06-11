/**
 * Deterministic `object-fit: cover` geometry.
 *
 * Both Google Messages and the iOS Messages RCS renderer scale card media to
 * fully cover the media container and crop the overflowing axis, anchored at
 * the center ("centered cropping", [CardMedia p12, p15] / [xPlatform s28]).
 * These helpers compute exactly which part of the source image survives.
 */

import type { FocalPoint } from "@/types/rcs";

/** The part of the source image (normalized 0..1 coords) visible in the container. */
export interface VisibleWindow {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Computes the visible window of an image rendered with `object-fit: cover`.
 *
 * @param imageAspect     source width / height
 * @param containerAspect container width / height
 * @param posX/posY       `object-position` fractions (0.5 = center crop)
 */
export function getVisibleWindow(
  imageAspect: number,
  containerAspect: number,
  posX = 0.5,
  posY = 0.5,
): VisibleWindow {
  // cover-scale: the axis whose ratio "loses" gets cropped.
  const visibleWidthFraction = Math.min(1, containerAspect / imageAspect);
  const visibleHeightFraction = Math.min(1, imageAspect / containerAspect);
  const x0 = (1 - visibleWidthFraction) * posX;
  const y0 = (1 - visibleHeightFraction) * posY;
  return { x0, y0, x1: x0 + visibleWidthFraction, y1: y0 + visibleHeightFraction };
}

/** Maps an image-space focal point into container-space (0..1) coordinates. */
export function focalInContainer(focal: FocalPoint, win: VisibleWindow) {
  const w = win.x1 - win.x0 || 1;
  const h = win.y1 - win.y0 || 1;
  const u = (focal.x - win.x0) / w;
  const v = (focal.y - win.y0) / h;
  return { u, v, visible: u >= 0 && u <= 1 && v >= 0 && v <= 1 };
}

/**
 * How much of the maximal cover window the "recommended re-crop" keeps.
 * 0.75 = a 25% punch-in on the subject. Showing MORE of an image is not the
 * same as the image looking BETTER: a deliberate tight crop around the focal
 * point beats an accidental wide crop with dead space.
 */
export const SUBJECT_PROMINENCE = 0.75;

/**
 * A tighter, focal-centered crop window used by improved previews to simulate
 * a re-cropped asset: same aspect ratio as the container, zoomed to
 * SUBJECT_PROMINENCE of the maximal cover window, centered on the focal point
 * (clamped so the window stays inside the image).
 */
export function subjectProminenceWindow(
  imageAspect: number,
  containerAspect: number,
  focal: FocalPoint,
  zoom: number = SUBJECT_PROMINENCE,
): VisibleWindow {
  const fw = Math.min(1, containerAspect / imageAspect) * zoom;
  const fh = Math.min(1, imageAspect / containerAspect) * zoom;
  const x0 = clamp(focal.x - fw / 2, 0, 1 - fw);
  const y0 = clamp(focal.y - fh / 2, 0, 1 - fh);
  return { x0, y0, x1: x0 + fw, y1: y0 + fh };
}

/** Fraction (0..1) of the source image area that survives the crop. */
export function visibleAreaFraction(win: VisibleWindow): number {
  return (win.x1 - win.x0) * (win.y1 - win.y0);
}

/**
 * The centered 1:1 "critical media content area" required for compact
 * (horizontal) cards [xPlatform s16]: a centered square over the source image,
 * expressed in normalized image coordinates.
 */
export function criticalSquareWindow(imageAspect: number): VisibleWindow {
  if (imageAspect >= 1) {
    const half = 1 / imageAspect / 2; // square width as a fraction of image width
    return { x0: 0.5 - half, y0: 0, x1: 0.5 + half, y1: 1 };
  }
  const half = imageAspect / 2; // square height as a fraction of image height
  return { x0: 0, y0: 0.5 - half, x1: 1, y1: 0.5 + half };
}

/** Whether a point sits inside a window. */
export function pointInWindow(point: FocalPoint, win: VisibleWindow): boolean {
  return point.x >= win.x0 && point.x <= win.x1 && point.y >= win.y0 && point.y <= win.y1;
}
