/**
 * GlowLogo.tsx
 * Simple logo component - icon + text
 * Uses centralized GlowIconComponent
 * @AshokSaravanan222 & @siladiea
 * 11/20/2025
 */
"use client";

import { GlowIconComponent } from "@/components/common/GlowIconComponent";

interface GlowLogoProps {
  /**
   * Whether to show only the icon on mobile (default: true)
   */
  mobileIconOnly?: boolean;
  /**
   * Whether the logo is clickable (default: true)
   */
  clickable?: boolean;
  /**
   * Click handler - if provided, logo will be clickable
   */
  onClick?: () => void;
  /**
   * Size variant - 'sm' for smaller header, 'md' for default, 'lg' for larger
   */
  size?: "sm" | "md" | "lg";
  /**
   * Whether to invert colors (white text instead of gradient) - for dark backgrounds
   */
  invertColors?: boolean;
  /**
   * Whether to use black text (for light backgrounds) - overrides invertColors text color
   */
  lightBackground?: boolean;
}

export function GlowLogo({
  mobileIconOnly = true,
  clickable = true,
  onClick,
  size = "sm",
  invertColors = false,
  lightBackground = false,
}: GlowLogoProps) {
  const iconSize = size === "sm" ? 20 : size === "md" ? 24 : 32;
  const textSize =
    size === "sm" ? "text-xl" : size === "md" ? "text-3xl" : "text-4xl";

  const handleClick = () => {
    if (clickable && onClick) {
      onClick();
    }
  };

  return (
    <div
      className={`flex items-center gap-2 ${clickable ? "cursor-pointer hover:opacity-90 transition-opacity" : ""}`}
      onClick={handleClick}
    >
      <div
        className={`rounded-lg border-2 ${invertColors ? "border-white" : "border-transparent"}`}
      >
        <GlowIconComponent
          size={iconSize}
          className="shadow-lg"
          config={
            lightBackground || invertColors
              ? {
                  gradientColors: {
                    start: "#3B82F6",
                    middle: "#2563EB",
                    end: "#1D4ED8",
                  },
                }
              : undefined
          }
        />
      </div>
      <h1
        className={`${textSize} font-bold transition-colors duration-300 ${
          lightBackground
            ? "text-black"
            : invertColors
              ? "text-white drop-shadow-lg"
              : "bg-gradient-to-br from-blue-300 to-blue-400 bg-clip-text text-transparent"
        } ${mobileIconOnly ? "hidden md:block" : ""}`}
      >
        GLOW
      </h1>
    </div>
  );
}
