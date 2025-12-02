/**
 * GlowIcon.tsx
 * Reusable Glow icon component - standalone SVG icon
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
 * Uses centralized GlowIconComponent
 */
export function GlowIcon(props: GlowIconComponentProps) {
  return <GlowIconComponent {...props} />;
}

/**
 * GlowIconSVG - Alias for GlowIcon (kept for backward compatibility)
 */
export function GlowIconSVG(props: GlowIconComponentProps) {
  return <GlowIconComponent {...props} />;
}
