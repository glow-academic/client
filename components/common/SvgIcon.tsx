/**
 * SvgIcon — renders inline SVG from a string.
 * Used for icons stored as SVG markup in the database (icons_resource.value).
 * SVGs use stroke="currentColor" so they inherit text color from parent.
 *
 * Injects className/style directly onto the <svg> element (same as Lucide)
 * and uses display:contents on the wrapper so it doesn't affect layout.
 */

import DOMPurify from "isomorphic-dompurify";

import { cn } from "@/lib/utils";

interface SvgIconProps {
  svg: string | null | undefined;
  className?: string;
  style?: React.CSSProperties;
  fallback?: React.ReactNode;
}

export function SvgIcon({ svg, className, style, fallback = null }: SvgIconProps) {
  if (!svg || !svg.trim().startsWith("<svg")) return <>{fallback}</>;

  // Build attributes to inject directly onto the <svg> element
  const cls = cn("shrink-0", className);
  const styleStr = style
    ? Object.entries(style)
        .map(([k, v]) => `${k.replace(/[A-Z]/g, (m) => "-" + m.toLowerCase())}:${v}`)
        .join(";")
    : "";

  const attrs = ` class="${cls}"${styleStr ? ` style="${styleStr}"` : ""}`;
  const modified = svg.replace("<svg", `<svg${attrs}`);

  // SECURITY: icons_resource.value is DB-sourced and rendered across cross-user
  // surfaces (chat, persona grids, resource pickers). The startsWith("<svg")
  // guard is bypassable (e.g. `<svg></svg><img src=x onerror=...>`), and the
  // <img onerror> fires from innerHTML. Sanitize to an SVG-only profile so only
  // valid SVG elements/attributes survive — <script>, <img>, and on* event
  // handlers are stripped — before injecting via dangerouslySetInnerHTML.
  const sanitized = DOMPurify.sanitize(modified, {
    USE_PROFILES: { svg: true, svgFilters: true },
  });

  return <span style={{ display: "contents" }} dangerouslySetInnerHTML={{ __html: sanitized }} />;
}
