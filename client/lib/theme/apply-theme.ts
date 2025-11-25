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
  cardForeground: "--card-foreground",
  popover: "--popover",
  popoverForeground: "--popover-foreground",
  primary: "--primary",
  primaryForeground: "--primary-foreground",
  secondary: "--secondary",
  secondaryForeground: "--secondary-foreground",
  muted: "--muted",
  mutedForeground: "--muted-foreground",
  accent: "--accent",
  accentForeground: "--accent-foreground",
  destructive: "--destructive",
  border: "--border",
  input: "--input",
  ring: "--ring",
  success: "--success",
  successForeground: "--success-foreground",
  warning: "--warning",
  warningForeground: "--warning-foreground",
  info: "--info",
  infoForeground: "--info-foreground",

  chart1: "--chart-1",
  chart2: "--chart-2",
  chart3: "--chart-3",
  chart4: "--chart-4",
  chart5: "--chart-5",

  sidebar: "--sidebar",
  sidebarForeground: "--sidebar-foreground",
  sidebarPrimary: "--sidebar-primary",
  sidebarPrimaryForeground: "--sidebar-primary-foreground",
  sidebarAccent: "--sidebar-accent",
  sidebarAccentForeground: "--sidebar-accent-foreground",
  sidebarBorder: "--sidebar-border",
  sidebarRing: "--sidebar-ring",
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
    }
  );
}
