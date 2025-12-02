/**
 * GlowIcon.tsx
 * Reusable Glow icon component - standalone SVG icon
 * Can be used for favicons, app icons, and UI elements
 * Now uses centralized GlowIconComponent
 * @AshokSaravanan222 & @siladiea
 * 12/2025
 */

import {
  GlowIconComponent,
  type GlowIconComponentProps,
} from "./GlowIconComponent";

/**
 * GlowIcon - Standalone SVG icon component
 * Based on the GlowLogo sparkle design
 * Uses centralized GlowIconComponent
 */
export function GlowIcon(props: GlowIconComponentProps) {
  return <GlowIconComponent {...props} />;
}

/**
 * GlowIconSVG - Inline SVG version (no image loading)
 * Use this when you need the SVG directly in the DOM
 * Note: Uses inline gradient to avoid ID conflicts when multiple instances are used
 */
export function GlowIconSVG({
  size = 32,
  className = "",
  gradientId,
}: {
  size?: number;
  className?: string;
  gradientId?: string;
}) {
  return (
    <GlowIconComponent
      size={size}
      className={className}
      inline={true}
      {...(gradientId ? { gradientId } : {})}
    />
  );
}
