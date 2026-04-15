/**
 * SvgIcon — renders inline SVG from a string.
 * Used for icons stored as SVG markup in the database (icons_resource.value).
 * SVGs use stroke="currentColor" so they inherit text color from parent.
 */

import { cn } from "@/lib/utils";

interface SvgIconProps {
  svg: string | null | undefined;
  className?: string;
  style?: React.CSSProperties;
  fallback?: React.ReactNode;
}

export function SvgIcon({ svg, className, style, fallback = null }: SvgIconProps) {
  if (!svg || !svg.trim().startsWith("<svg")) return <>{fallback}</>;

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center [&>svg]:w-full [&>svg]:h-full [&>svg]:block",
        className,
      )}
      style={style}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
