/**
 * GlowIconComponent.tsx
 * Centralized Glow icon component - single entrypoint for all icon usage
 * Dynamically generates SVG - no static files needed
 * @AshokSaravanan222 & @siladiea
 * 12/2025
 */
"use client";

import { useId } from "react";

/**
 * Configuration for the Glow icon
 * This can be extended in the future to support dynamic generation
 */
export interface GlowIconConfig {
  /**
   * Size of the icon in pixels
   */
  size?: number;
  /**
   * ViewBox size (for scaling)
   */
  viewBoxSize?: number;
  /**
   * Border radius for the rounded square container
   */
  borderRadius?: number;
  /**
   * Gradient colors
   */
  gradientColors?: {
    start: string;
    middle: string;
    end: string;
  };
  /**
   * Sparkle scale factor
   */
  sparkleScale?: number;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: Required<GlowIconConfig> = {
  size: 32,
  viewBoxSize: 32,
  borderRadius: 8,
  gradientColors: {
    start: "#93C5FD",
    middle: "#60A5FA",
    end: "#3B82F6",
  },
  sparkleScale: 0.667,
};

/**
 * Generates the SVG markup for the Glow icon
 * This function can be extended in the future to support dynamic generation
 * @param config - Configuration for the icon
 * @param gradientId - Unique ID for the gradient (to avoid conflicts)
 * @returns SVG markup as a string
 */
export function generateGlowIconSVG(
  config: GlowIconConfig = {},
  gradientId: string = "glowGradient",
): string {
  const { size, viewBoxSize, borderRadius, gradientColors, sparkleScale } = {
    ...DEFAULT_CONFIG,
    ...config,
  };

  const center = viewBoxSize / 2;

  return `
    <svg width="${size}" height="${size}" viewBox="0 0 ${viewBoxSize} ${viewBoxSize}" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="${gradientId}" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${gradientColors.start}" />
          <stop offset="50%" stop-color="${gradientColors.middle}" />
          <stop offset="100%" stop-color="${gradientColors.end}" />
        </linearGradient>
      </defs>
      <!-- Rounded square container -->
      <rect width="${viewBoxSize}" height="${viewBoxSize}" rx="${borderRadius}" fill="url(#${gradientId})"/>
      <!-- Main sparkle icon - centered and properly sized (perfectly square) -->
      <g transform="translate(${center}, ${center}) scale(${sparkleScale})">
        <path d="M0 -11L2.59 -2.59L11 0L2.59 2.59L0 11L-2.59 2.59L-11 0L-2.59 -2.59L0 -11Z" fill="white"/>
      </g>
    </svg>
  `.trim();
}

/**
 * Renders the Glow icon as a React component (inline SVG)
 * This is the preferred method for rendering inline SVGs
 */
export function GlowIconSVGElement({
  config = {},
  gradientId,
  className = "",
}: {
  config?: GlowIconConfig;
  gradientId?: string;
  className?: string;
}) {
  const { size, viewBoxSize, borderRadius, gradientColors, sparkleScale } = {
    ...DEFAULT_CONFIG,
    ...config,
  };

  // Use React's useId() for stable, hydration-safe unique IDs
  const reactId = useId();
  const uniqueId = gradientId || `glow-gradient-${reactId.replace(/:/g, "-")}`;
  const center = viewBoxSize / 2;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id={uniqueId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={gradientColors.start} />
          <stop offset="50%" stopColor={gradientColors.middle} />
          <stop offset="100%" stopColor={gradientColors.end} />
        </linearGradient>
      </defs>
      {/* Rounded square container */}
      <rect
        width={viewBoxSize}
        height={viewBoxSize}
        rx={borderRadius}
        fill={`url(#${uniqueId})`}
      />
      {/* Main sparkle icon - centered and properly sized (perfectly square) */}
      <g transform={`translate(${center}, ${center}) scale(${sparkleScale})`}>
        <path
          d="M0 -11L2.59 -2.59L11 0L2.59 2.59L0 11L-2.59 2.59L-11 0L-2.59 -2.59L0 -11Z"
          fill="white"
        />
      </g>
    </svg>
  );
}

/**
 * Props for the GlowIconComponent
 */
export interface GlowIconComponentProps {
  /**
   * Size of the icon in pixels (default: 32)
   */
  size?: number;
  /**
   * Additional className for styling
   */
  className?: string;
  /**
   * Custom configuration for dynamic generation
   */
  config?: GlowIconConfig;
  /**
   * Custom gradient ID (for avoiding conflicts when multiple instances)
   */
  gradientId?: string;
}

/**
 * GlowIconComponent - Centralized icon component
 * Single entrypoint for all Glow icon usage - dynamically generates SVG
 *
 * Usage:
 * <GlowIconComponent size={32} />
 */
export function GlowIconComponent({
  size = 32,
  className = "",
  config,
  gradientId,
}: GlowIconComponentProps) {
  return (
    <GlowIconSVGElement
      config={{ size, ...config }}
      {...(gradientId ? { gradientId } : {})}
      className={className}
    />
  );
}
