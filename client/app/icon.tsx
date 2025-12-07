/**
 * icon.tsx
 * Next.js App Router icon file - used for favicon
 * Dynamically generates icon using ImageResponse
 * Uses centralized icon design matching GlowIconComponent
 */

import { ImageResponse } from "next/og";

export const size = {
  width: 32,
  height: 32,
};

export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <svg
        width="32"
        height="32"
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="glowGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#93C5FD" />
            <stop offset="50%" stopColor="#60A5FA" />
            <stop offset="100%" stopColor="#3B82F6" />
          </linearGradient>
        </defs>
        {/* Rounded square container */}
        <rect width="32" height="32" rx="8" fill="url(#glowGradient)" />
        {/* Main sparkle icon - centered and properly sized */}
        <g transform="translate(16, 16) scale(0.667)">
          <path
            d="M0 -11L2.59 -2.59L11 0L2.59 2.59L0 11L-2.59 2.59L-11 0L-2.59 -2.59L0 -11Z"
            fill="white"
          />
        </g>
      </svg>
    ),
    {
      ...size,
    },
  );
}
