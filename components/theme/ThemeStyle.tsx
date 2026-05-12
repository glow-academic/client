/**
 * SSR-rendered `<style>` block(s) that override the CSS variables in
 * `app/globals.css` with the active setting's derived theme tokens.
 *
 * Emits up to two blocks:
 *   - `:root:not(.dark) { ... }`   when light tokens are present
 *   - `:root.dark       { ... }`   when dark tokens are present
 *
 * Both blocks ship in the SSR HTML — first paint is already themed,
 * no useEffect, no flash. The `.dark` class is toggled by next-themes
 * on the `<html>` element; the cascade picks the matching block.
 *
 * Empty-in → empty-out: any token whose value is empty is skipped, so
 * the matching `globals.css` default takes over. A setting with no dark
 * palette renders no dark block at all → native dark mode applies.
 *
 * Server is the sole owner of derivation (`derive_theme_tokens` in
 * `core/app/utils/settings/theme.py`); the client just emits values.
 */
import type { components } from "@/lib/api/schema";

type ThemeTokens = components["schemas"]["ThemeTokens"];

const TOKEN_TO_VAR: Record<keyof ThemeTokens, string> = {
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
  destructive_foreground: "--destructive-foreground",
  danger: "--danger",
  danger_foreground: "--danger-foreground",
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

function toDeclarations(tokens: ThemeTokens): string {
  return (Object.entries(TOKEN_TO_VAR) as [keyof ThemeTokens, string][])
    .map(([key, cssVar]) => {
      const value = tokens[key];
      return value ? `${cssVar}:${value};` : "";
    })
    .filter(Boolean)
    .join("");
}

export function ThemeStyle({
  tokens,
  darkTokens,
}: {
  tokens: ThemeTokens | null;
  darkTokens: ThemeTokens | null;
}) {
  const lightDecls = tokens ? toDeclarations(tokens) : "";
  const darkDecls = darkTokens ? toDeclarations(darkTokens) : "";

  if (!lightDecls && !darkDecls) return null;

  // One <style> per scope. Skip a scope entirely if there's nothing to
  // emit, so native globals.css defaults paint that mode.
  return (
    <>
      {lightDecls && <style>{`:root:not(.dark){${lightDecls}}`}</style>}
      {darkDecls && <style>{`:root.dark{${darkDecls}}`}</style>}
    </>
  );
}
