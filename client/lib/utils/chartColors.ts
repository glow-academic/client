"use client";

import { useCSSVariable } from "@/lib/hooks/useCSSVariable";

/**
 * Converts oklch() color to a format Recharts can understand.
 * Recharts supports rgb(), rgba(), hsl(), hsla(), and hex colors.
 * If the color is already in a supported format, returns it as-is.
 *
 * @param oklchValue - Color value in oklch() or other format
 * @returns Color in a format Recharts can use
 */
function convertColorForRecharts(oklchValue: string): string {
  // If it's already in a supported format, return as-is
  if (
    oklchValue.startsWith("rgb") ||
    oklchValue.startsWith("#") ||
    oklchValue.startsWith("hsl")
  ) {
    return oklchValue;
  }

  // For oklch() values, we need to convert to a supported format
  // Create a temporary element to get computed RGB value
  if (typeof window !== "undefined" && typeof document !== "undefined") {
    const tempEl = document.createElement("div");
    tempEl.style.color = oklchValue;
    tempEl.style.position = "absolute";
    tempEl.style.visibility = "hidden";
    document.body.appendChild(tempEl);
    const computedColor = getComputedStyle(tempEl).color;
    document.body.removeChild(tempEl);

    // getComputedStyle returns rgb() format, which Recharts supports
    return computedColor || oklchValue;
  }

  // Fallback during SSR
  return oklchValue;
}

/**
 * Hook to get chart color based on status.
 * Returns the computed CSS variable value converted to a format Recharts can use.
 *
 * @param status - Status type: "success", "warning", "danger", or "neutral"
 * @returns Color value in a format Recharts can use
 */
export function useStatusColor(
  status: "success" | "warning" | "danger" | "neutral",
): string {
  const successColor = useCSSVariable("--success", "oklch(0.6 0.2 150)");
  const warningColor = useCSSVariable("--warning", "oklch(0.7 0.2 70)");
  const destructiveColor = useCSSVariable(
    "--destructive",
    "oklch(0.577 0.245 27.325)",
  );
  const mutedColor = useCSSVariable("--muted-foreground", "oklch(0.556 0 0)");

  const colorMap = {
    success: successColor,
    warning: warningColor,
    danger: destructiveColor,
    neutral: mutedColor,
  };

  const rawColor = colorMap[status];
  return convertColorForRecharts(rawColor);
}

const fallbacks = {
  success: "oklch(0.6 0.2 150)",
  warning: "oklch(0.7 0.2 70)",
  danger: "oklch(0.577 0.245 27.325)",
  neutral: "oklch(0.556 0 0)",
};

export const chartColorFallbacks = {
  chart1: "oklch(0.646 0.222 41.116)",
  chart2: "oklch(0.6 0.118 184.704)",
  chart3: "oklch(0.398 0.07 227.392)",
  chart4: "oklch(0.828 0.189 84.429)",
  chart5: "oklch(0.769 0.188 70.08)",
};

/**
 * Hook to get chart colors 1-5 from CSS variables.
 * Returns an array of 5 colors in a format Recharts can use.
 *
 * @returns Array of 5 chart colors
 */
export function useChartColors(): string[] {
  const chart1 = useCSSVariable("--chart-1", chartColorFallbacks.chart1);
  const chart2 = useCSSVariable("--chart-2", chartColorFallbacks.chart2);
  const chart3 = useCSSVariable("--chart-3", chartColorFallbacks.chart3);
  const chart4 = useCSSVariable("--chart-4", chartColorFallbacks.chart4);
  const chart5 = useCSSVariable("--chart-5", chartColorFallbacks.chart5);

  return [
    convertColorForRecharts(chart1),
    convertColorForRecharts(chart2),
    convertColorForRecharts(chart3),
    convertColorForRecharts(chart4),
    convertColorForRecharts(chart5),
  ];
}

/**
 * Non-hook version to get chart colors 1-5.
 * Gets the computed CSS variable values directly from the DOM.
 *
 * @returns Array of 5 chart colors
 */
export function getChartColors(): string[] {
  if (typeof window === "undefined" || typeof document === "undefined") {
    // SSR fallback
    return Object.values(chartColorFallbacks).map((color) =>
      convertColorForRecharts(color),
    );
  }

  const root = document.documentElement;
  const chartColors = [
    getComputedStyle(root).getPropertyValue("--chart-1").trim() ||
      chartColorFallbacks.chart1,
    getComputedStyle(root).getPropertyValue("--chart-2").trim() ||
      chartColorFallbacks.chart2,
    getComputedStyle(root).getPropertyValue("--chart-3").trim() ||
      chartColorFallbacks.chart3,
    getComputedStyle(root).getPropertyValue("--chart-4").trim() ||
      chartColorFallbacks.chart4,
    getComputedStyle(root).getPropertyValue("--chart-5").trim() ||
      chartColorFallbacks.chart5,
  ];

  return chartColors.map((color) => convertColorForRecharts(color));
}

/**
 * Applies alpha/opacity to a color string in any format (rgb, hex, oklch).
 * Returns an rgba() color string.
 *
 * @param color - Color in rgb()/hex/oklch format (as returned by useChartColors)
 * @param alpha - Alpha value from 0 to 1
 * @returns Color string with alpha applied
 */
export function colorWithAlpha(color: string, alpha: number): string {
  // Handle rgb(r, g, b) or rgb(r g b) format
  const rgbMatch = color.match(
    /rgb\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)\s*\)/,
  );
  if (rgbMatch) {
    return `rgba(${rgbMatch[1]}, ${rgbMatch[2]}, ${rgbMatch[3]}, ${alpha})`;
  }

  // Handle hex format
  if (color.startsWith("#")) {
    const hex = color.slice(1);
    let r: number, g: number, b: number;
    if (hex.length === 3) {
      r = parseInt(hex[0] + hex[0], 16);
      g = parseInt(hex[1] + hex[1], 16);
      b = parseInt(hex[2] + hex[2], 16);
    } else {
      r = parseInt(hex.slice(0, 2), 16);
      g = parseInt(hex.slice(2, 4), 16);
      b = parseInt(hex.slice(4, 6), 16);
    }
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  // For oklch or other formats, use color-mix as fallback
  return `color-mix(in srgb, ${color} ${Math.round(alpha * 100)}%, transparent)`;
}

/**
 * Returns inline style for a subtle chart-color background gradient.
 * Useful for applying chart colors to card backgrounds at runtime.
 *
 * @param color - Chart color in rgb/hex/oklch format
 * @param intensity - Opacity intensity from 0 to 1 (default 0.08)
 * @returns React CSSProperties with background and border
 */
export function chartColorBackground(
  color: string,
  intensity: number = 0.08,
): { background: string; border: string } {
  return {
    background: `linear-gradient(to bottom right, ${colorWithAlpha(color, intensity)}, ${colorWithAlpha(color, intensity * 0.5)})`,
    border: `1px solid ${colorWithAlpha(color, intensity * 2.5)}`,
  };
}

/**
 * Non-hook version for use in non-component contexts.
 * Gets the computed CSS variable value directly from the DOM.
 *
 * @param status - Status type: "success", "warning", "danger", or "neutral"
 * @returns Color value in a format Recharts can use
 */
export function getStatusColor(
  status: "success" | "warning" | "danger" | "neutral",
): string {
  if (typeof window === "undefined" || typeof document === "undefined") {
    // SSR fallback
    return fallbacks[status];
  }

  const root = document.documentElement;
  const variableMap = {
    success: "--success",
    warning: "--warning",
    danger: "--destructive",
    neutral: "--muted-foreground",
  };

  const variableName = variableMap[status];
  const rawColor =
    getComputedStyle(root).getPropertyValue(variableName).trim() ||
    fallbacks[status];

  return convertColorForRecharts(rawColor);
}
