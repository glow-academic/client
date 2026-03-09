/**
 * Derive CSS theme tokens from raw hex color primitives.
 *
 * Ported from server-side Python (app/routes/auth/permissions.py).
 * Converts hex → oklch, then derives 30+ tokens via contrast/tint/shade.
 */

// ---------------------------------------------------------------------------
// oklch parsing & formatting
// ---------------------------------------------------------------------------

interface OKLCH {
  l: number;
  c: number;
  h: number;
}

function parseOklch(s: string): OKLCH {
  const m = s.match(
    /oklch\(([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*[\d.]+%?)?\)/,
  );
  if (!m || !m[1] || !m[2] || !m[3]) throw new Error(`Invalid oklch: ${s}`);
  return { l: +m[1], c: +m[2], h: +m[3] };
}

function fmtOklch({ l, c, h }: OKLCH): string {
  return `oklch(${l} ${c} ${h})`;
}

// ---------------------------------------------------------------------------
// hex ↔ oklch conversion
// ---------------------------------------------------------------------------

function invGamma(v: number): number {
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

function hexToOklch(hex: string): string {
  const h = hex.replace("#", "");
  const r = invGamma(parseInt(h.slice(0, 2), 16) / 255);
  const g = invGamma(parseInt(h.slice(2, 4), 16) / 255);
  const b = invGamma(parseInt(h.slice(4, 6), 16) / 255);

  // Linear RGB → OKLab
  const l_ = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const m_ = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const s_ = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;

  const lc = l_ > 0 ? l_ ** (1 / 3) : 0;
  const mc = m_ > 0 ? m_ ** (1 / 3) : 0;
  const sc = s_ > 0 ? s_ ** (1 / 3) : 0;

  const L = 0.2104542553 * lc + 0.793617785 * mc - 0.0040720468 * sc;
  const a = 1.9779984951 * lc - 2.428592205 * mc + 0.4505937099 * sc;
  const bLab = 0.0259040371 * lc + 0.7827717662 * mc - 0.808675766 * sc;

  const C = Math.sqrt(a * a + bLab * bLab);
  let H = (Math.atan2(bLab, a) * 180) / Math.PI;
  if (H < 0) H += 360;

  return `oklch(${L.toFixed(3)} ${C.toFixed(3)} ${H.toFixed(1)})`;
}

function toOklch(color: string): string {
  const trimmed = color.trim();
  if (trimmed.startsWith("oklch(")) return trimmed;
  return hexToOklch(trimmed.startsWith("#") ? trimmed : `#${trimmed}`);
}

// ---------------------------------------------------------------------------
// Color manipulation
// ---------------------------------------------------------------------------

function tint(color: string, amount: number): string {
  const { l, c, h } = parseOklch(color);
  return fmtOklch({
    l: l + (1.0 - l) * amount,
    c: c * (1.0 - amount * 0.5),
    h,
  });
}

function shade(color: string, amount: number): string {
  const { l, c, h } = parseOklch(color);
  return fmtOklch({
    l: l * (1.0 - amount),
    c: c * (1.0 + amount * 0.1),
    h,
  });
}

function ensureContrast(bg: string, candidate: string): string {
  const bgL = parseOklch(bg).l;
  const cand = parseOklch(candidate);

  if (bgL > 0.5) {
    // Light background → dark text
    if (cand.l > 0.3) return "oklch(0.145 0 0)";
  } else {
    // Dark background → light text
    if (cand.l < 0.7) return "oklch(0.985 0 0)";
  }
  return fmtOklch(cand);
}

// ---------------------------------------------------------------------------
// Public: derive tokens from primitives
// ---------------------------------------------------------------------------

export interface ThemePrimitives {
  primary?: string | null;
  accent?: string | null;
  background?: string | null;
  surface?: string | null;
  success?: string | null;
  warning?: string | null;
  error?: string | null;
  chart1?: string | null;
  chart2?: string | null;
  chart3?: string | null;
  chart4?: string | null;
  chart5?: string | null;
}

export interface DerivedThemeTokens {
  // Core
  background: string;
  foreground: string;
  card: string;
  card_foreground: string;
  popover: string;
  popover_foreground: string;
  primary: string;
  primary_foreground: string;
  secondary: string;
  secondary_foreground: string;
  muted: string;
  muted_foreground: string;
  accent: string;
  accent_foreground: string;
  destructive: string;
  border: string;
  input: string;
  ring: string;
  // Semantic
  success: string;
  success_foreground: string;
  warning: string;
  warning_foreground: string;
  info: string;
  info_foreground: string;
  // Charts
  chart1: string;
  chart2: string;
  chart3: string;
  chart4: string;
  chart5: string;
  // Sidebar (derived from background + primary)
  sidebar: string;
  sidebar_foreground: string;
  sidebar_primary: string;
  sidebar_primary_foreground: string;
  sidebar_accent: string;
  sidebar_accent_foreground: string;
  sidebar_border: string;
  sidebar_ring: string;
}

export function deriveThemeTokens(p: ThemePrimitives): DerivedThemeTokens {
  const background = toOklch(p.background || "#ffffff");
  const surface = toOklch(p.surface || "#ffffff");
  const primary = toOklch(p.primary || "#000000");
  const accentColor = toOklch(p.accent || "#f5f5f5");
  const successColor = toOklch(p.success || "#009e34");
  const warningColor = toOklch(p.warning || "#ea8100");
  const errorColor = toOklch(p.error || "#e7000b");

  const foreground = ensureContrast(background, "oklch(0.145 0 0)");
  const primaryFg = ensureContrast(primary, "oklch(0.985 0 0)");
  const accentFg = ensureContrast(accentColor, "oklch(0.205 0 0)");
  const surfaceFg = ensureContrast(surface, foreground);

  const successFg = ensureContrast(successColor, "oklch(0.985 0 0)");
  const warningFg = ensureContrast(warningColor, "oklch(0.145 0 0)");
  // errorFg not used directly — destructive color is the error itself

  const infoColor = tint(primary, 0.05);
  const infoFg = ensureContrast(infoColor, foreground);

  const mutedColor = shade(background, 0.03);
  const mutedFg = shade(foreground, 0.2);
  const borderColor = shade(background, 0.078);
  const inputColor = shade(background, 0.078);
  const ringColor = shade(primary, 0.05);

  // Sidebar derived from background + primary (no separate sidebar primitives)
  const sidebarBg = background;
  const sidebarPrimary = primary;
  const sidebarFg = ensureContrast(sidebarBg, surfaceFg);
  const sidebarPrimaryFg = ensureContrast(sidebarPrimary, surfaceFg);
  const sidebarAccent = shade(sidebarBg, 0.015);
  const sidebarAccentFg = ensureContrast(sidebarAccent, surfaceFg);
  const sidebarBorder = shade(sidebarBg, 0.064);
  const sidebarRing = shade(sidebarPrimary, 0.05);

  return {
    background,
    foreground,
    card: surface,
    card_foreground: surfaceFg,
    popover: surface,
    popover_foreground: surfaceFg,
    primary,
    primary_foreground: primaryFg,
    secondary: accentColor,
    secondary_foreground: accentFg,
    muted: mutedColor,
    muted_foreground: mutedFg,
    accent: accentColor,
    accent_foreground: accentFg,
    destructive: errorColor,
    border: borderColor,
    input: inputColor,
    ring: ringColor,
    success: successColor,
    success_foreground: successFg,
    warning: warningColor,
    warning_foreground: warningFg,
    info: infoColor,
    info_foreground: infoFg,
    chart1: toOklch(p.chart1 || "#000000"),
    chart2: toOklch(p.chart2 || "#666666"),
    chart3: toOklch(p.chart3 || "#999999"),
    chart4: toOklch(p.chart4 || "#cccccc"),
    chart5: toOklch(p.chart5 || "#eeeeee"),
    sidebar: sidebarBg,
    sidebar_foreground: sidebarFg,
    sidebar_primary: sidebarPrimary,
    sidebar_primary_foreground: sidebarPrimaryFg,
    sidebar_accent: sidebarAccent,
    sidebar_accent_foreground: sidebarAccentFg,
    sidebar_border: sidebarBorder,
    sidebar_ring: sidebarRing,
  };
}
