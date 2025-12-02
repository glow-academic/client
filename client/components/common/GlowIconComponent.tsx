/**
 * GlowIconComponent.tsx
 * Centralized Glow icon component - single entrypoint for all icon usage
 * Can be extended to dynamically generate SVGs in the future
 * @AshokSaravanan222 & @siladiea
 * 12/2025
 */

import Image from "next/image";

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
  gradientId: string = "glowGradient"
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

  const uniqueId =
    gradientId || `glow-gradient-${Math.random().toString(36).substr(2, 9)}`;
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
   * Whether to use the simple version (smaller, optimized for favicons)
   * Currently uses static file, but can be extended to use generateGlowIconSVG
   */
  simple?: boolean;
  /**
   * Additional className for styling
   */
  className?: string;
  /**
   * Whether to render as inline SVG instead of using Image component
   * Use this when you need the SVG directly in the DOM
   */
  inline?: boolean;
  /**
   * Custom configuration for dynamic generation (only used when inline=true)
   */
  config?: GlowIconConfig;
  /**
   * Custom gradient ID (only used when inline=true)
   */
  gradientId?: string;
}

/**
 * GlowIconComponent - Centralized icon component
 * Single entrypoint for all Glow icon usage
 *
 * Usage:
 * - As Image component (default): <GlowIconComponent size={32} />
 * - As inline SVG: <GlowIconComponent size={32} inline />
 *
 * Future: Can be extended to use generateGlowIconSVG() for dynamic generation
 */
export function GlowIconComponent({
  size = 32,
  simple = false,
  className = "",
  inline = false,
  config,
  gradientId,
}: GlowIconComponentProps) {
  // If inline, render SVG directly as React component
  if (inline) {
    return (
      <GlowIconSVGElement
        config={{ size, ...config }}
        {...(gradientId ? { gradientId } : {})}
        className={className}
      />
    );
  }

  // Otherwise, use static file (can be replaced with dynamic generation in the future)
  const iconPath = simple ? "/glow-icon-simple.svg" : "/glow-icon.svg";

  return (
    <Image
      src={iconPath}
      alt="GLOW Icon"
      width={size}
      height={size}
      className={className}
      priority
    />
  );
}
