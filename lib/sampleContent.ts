/**
 * Built-in demo content so the simulator tells its story on first load:
 * long texts (truncation + crop severity) and a product placed top-right,
 * outside the safe zone (focal-point warnings) — the exact failure modes the
 * playbooks warn about.
 */

import type { RcsContent } from "@/types/rcs";

const SAMPLE_W = 800;
const SAMPLE_H = 1000;

/** The demo product is intentionally drawn top-right, outside the safe zone. */
export const SAMPLE_FOCAL = { x: 0.82, y: 0.18 };

const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${SAMPLE_W}" height="${SAMPLE_H}" viewBox="0 0 ${SAMPLE_W} ${SAMPLE_H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#1c2742"/>
      <stop offset="0.55" stop-color="#27406b"/>
      <stop offset="1" stop-color="#0e1424"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.82" cy="0.18" r="0.4">
      <stop offset="0" stop-color="#9fc4ff" stop-opacity="0.55"/>
      <stop offset="1" stop-color="#9fc4ff" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="watch" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#e8ecf5"/>
      <stop offset="1" stop-color="#aab4c8"/>
    </linearGradient>
  </defs>
  <rect width="${SAMPLE_W}" height="${SAMPLE_H}" fill="url(#bg)"/>
  <rect width="${SAMPLE_W}" height="${SAMPLE_H}" fill="url(#glow)"/>
  <g opacity="0.18" stroke="#7e93bd" stroke-width="1.5">
    ${Array.from({ length: 9 }, (_, i) => `<line x1="0" y1="${(i + 1) * 100}" x2="${SAMPLE_W}" y2="${(i + 1) * 100}"/>`).join("")}
    ${Array.from({ length: 7 }, (_, i) => `<line x1="${(i + 1) * 100}" y1="0" x2="${(i + 1) * 100}" y2="${SAMPLE_H}"/>`).join("")}
  </g>
  <!-- product: a smartwatch at (82%, 18%) — deliberately OUTSIDE the central safe zone -->
  <g transform="translate(${SAMPLE_W * 0.82} ${SAMPLE_H * 0.18})">
    <rect x="-26" y="-110" width="52" height="220" rx="26" fill="#39455e"/>
    <circle r="86" fill="url(#watch)"/>
    <circle r="70" fill="#10182b"/>
    <circle r="70" fill="none" stroke="#5b89ff" stroke-width="3" stroke-dasharray="8 10"/>
    <text y="-12" text-anchor="middle" font-family="ui-monospace, monospace" font-size="30" fill="#cfe0ff">09:41</text>
    <text y="26" text-anchor="middle" font-family="ui-monospace, monospace" font-size="16" fill="#5b89ff">PULSE ULTRA</text>
  </g>
  <text x="56" y="${SAMPLE_H - 150}" font-family="Georgia, serif" font-size="64" fill="#f2f5fb">Pulse Ultra</text>
  <text x="56" y="${SAMPLE_H - 96}" font-family="Georgia, serif" font-size="30" fill="#9fb0cf">The watch that listens first.</text>
  <text x="56" y="${SAMPLE_H - 48}" font-family="ui-monospace, monospace" font-size="22" fill="#5b89ff">naxai.demo / spring launch</text>
</svg>`;

export const SAMPLE_IMAGE_URL = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

export const DEFAULT_CONTENT: RcsContent = {
  title: "Pulse Ultra Smartwatch — Pre-order today and save 20% with free engraving",
  description:
    "Meet the next generation of health tracking with a 10-day battery, on-wrist ECG and sleep coaching powered by your own data. Pre-order before Sunday and we will include free delivery, setup support and a second strap of your choice.",
  imageUrl: SAMPLE_IMAGE_URL,
  imageMetadata: {
    width: SAMPLE_W,
    height: SAMPLE_H,
    aspectRatio: SAMPLE_W / SAMPLE_H,
  },
  actions: [
    { id: "a1", type: "openUrl", label: "Pre-order now", value: "https://naxai.example/pulse-ultra", primary: true },
    { id: "a2", type: "dial", label: "Call a store advisor for details", value: "+3225550123" },
    { id: "a3", type: "reply", label: "Send me more info", value: "MORE_INFO" },
  ],
  focalPoint: SAMPLE_FOCAL,
  cardFormat: "compact",
};
