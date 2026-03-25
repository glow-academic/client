/**
 * apple-icon.tsx
 * Next.js App Router apple-icon file - used for Apple touch icons
 * Dynamically generates icon using ImageResponse
 * Uses centralized icon design matching GlowIconComponent
 */

import { ImageResponse } from "next/og";

export const size = {
  width: 180,
  height: 180,
};

export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <svg
        width="180"
        height="180"
        viewBox="0 0 180 180"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient
            id="glowGradientApple"
            x1="0%"
            y1="0%"
            x2="100%"
            y2="100%"
          >
            <stop offset="0%" stopColor="#93C5FD" />
            <stop offset="50%" stopColor="#60A5FA" />
            <stop offset="100%" stopColor="#3B82F6" />
          </linearGradient>
        </defs>
        {/* Rounded square container - larger border radius for Apple icon */}
        <rect width="180" height="180" rx="40" fill="url(#glowGradientApple)" />
        {/* Main sparkle icon - centered and scaled appropriately */}
        <g transform="translate(90, 90) scale(3.75)">
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
