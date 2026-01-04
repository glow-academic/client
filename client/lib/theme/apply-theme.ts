import type { ThemeTokens } from "./types";

/**
 * Maps theme token keys to their corresponding CSS variable names.
 * This bridges the semantic token names from the API to the CSS variables
 * used throughout the application.
 */
const CSS_VAR_MAP: Record<keyof ThemeTokens, string> = {
  background: "--background",
  foreground: "--foreground",
  card: "--card",
  card_foreground: "--card-foreground",
  popover: "--popover",
  popover_foreground: "--popover-foreground",
  primary_color: "--primary",
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
 * Applies theme tokens to CSS variables on the document root.
 * This function sets CSS custom properties that are used throughout
 * the application for theming.
 *
 * @param tokens - Theme tokens object containing color values
 */
export function applyThemeTokens(tokens: ThemeTokens): void {
  // Early return for SSR - document is not available on the server
  if (typeof document === "undefined") return;

  const root = document.documentElement;

  (Object.entries(tokens) as [keyof ThemeTokens, string][]).forEach(
    ([key, value]) => {
      const cssVar = CSS_VAR_MAP[key];
      if (!cssVar || !value) return;
      root.style.setProperty(cssVar, value);
    },
  );
}
