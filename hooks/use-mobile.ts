import * as React from "react";

const MOBILE_BREAKPOINT = 768;
const NARROW_BREAKPOINT = 1280;

/**
 * Match a max-width media query as a boolean. SSR returns false until hydrated.
 */
function useMaxWidth(breakpoint: number): boolean {
  const [matches, setMatches] = React.useState<boolean | undefined>(
    typeof window !== "undefined"
      ? window.matchMedia(`(max-width: ${breakpoint - 1}px)`).matches
      : undefined,
  );

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const onChange = () => setMatches(window.innerWidth < breakpoint);
    mql.addEventListener("change", onChange);
    setMatches(window.innerWidth < breakpoint);
    return () => mql.removeEventListener("change", onChange);
  }, [breakpoint]);

  return matches ?? false;
}

export function useIsMobile() {
  return useMaxWidth(MOBILE_BREAKPOINT);
}

/**
 * True when viewport is narrow enough that secondary panels (e.g. the right AI
 * panel) should render as an overlay drawer rather than taking layout space.
 * Threshold sits well above the mobile cutoff because two persistent sidebars
 * + content need real estate that small laptops don't have.
 */
export function useIsNarrow() {
  return useMaxWidth(NARROW_BREAKPOINT);
}
