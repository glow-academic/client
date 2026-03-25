import type { DerivedThemeTokens } from "./derive-tokens";

/**
 * Maps theme token keys to their corresponding CSS variable names.
 */
const CSS_VAR_MAP: Record<keyof DerivedThemeTokens, string> = {
  background: "--background",
  foreground: "--foreground",
  card: "--card",
  card_foreground: "--card-foreground",
  popover: "--popover",
  popover_foreground: "--popover-foreground",
  primary: "--primary",
  primary_foreground: "--primary-foreground",
  secondary: "--secondary",
  secondary_foreground: "--secondary-foreground",
  muted: "--muted",
  muted_foreground: "--muted-foreground",
  accent: "--accent",
  accent_foreground: "--accent-foreground",
  destructive: "--destructive",
  border: "--border",
  input: "--input",
  ring: "--ring",
  success: "--success",
  success_foreground: "--success-foreground",
  warning: "--warning",
  warning_foreground: "--warning-foreground",
  info: "--info",
  info_foreground: "--info-foreground",

  chart1: "--chart-1",
  chart2: "--chart-2",
  chart3: "--chart-3",
  chart4: "--chart-4",
  chart5: "--chart-5",

  sidebar: "--sidebar",
  sidebar_foreground: "--sidebar-foreground",
  sidebar_primary: "--sidebar-primary",
  sidebar_primary_foreground: "--sidebar-primary-foreground",
  sidebar_accent: "--sidebar-accent",
  sidebar_accent_foreground: "--sidebar-accent-foreground",
  sidebar_border: "--sidebar-border",
  sidebar_ring: "--sidebar-ring",
};

/**
 * Applies derived theme tokens to CSS variables on the document root.
 */
export function applyThemeTokens(tokens: DerivedThemeTokens): void {
  if (typeof document === "undefined") return;

  const root = document.documentElement;

  (Object.entries(tokens) as [keyof DerivedThemeTokens, string][]).forEach(
    ([key, value]) => {
      const cssVar = CSS_VAR_MAP[key];
      if (!cssVar || !value) return;
      root.style.setProperty(cssVar, value);
    },
  );
}
