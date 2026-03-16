/**
 * color-helpers.ts
 * Utility functions for color manipulation and display
 */

/**
 * Get human-readable color name from hex color code
 * @param hex - Hex color code (with or without #)
 * @returns Human-readable color name or "Custom" if not found
 */
export function getColorName(hex: string): string {
  const colorMap: Record<string, string> = {
    "#000000": "Black",
    "#FFFFFF": "White",
    "#FF0000": "Red",
    "#00FF00": "Green",
    "#0000FF": "Blue",
    "#FFFF00": "Yellow",
    "#FF00FF": "Magenta",
    "#00FFFF": "Cyan",
    "#FFA500": "Orange",
    "#800080": "Purple",
    "#FFC0CB": "Pink",
    "#A52A2A": "Brown",
    "#808080": "Gray",
    "#FFD700": "Gold",
    "#C0C0C0": "Silver",
    "#008000": "Dark Green",
    "#000080": "Navy",
    "#800000": "Maroon",
    "#EF4444": "Red",
    "#F97316": "Orange",
    "#F59E0B": "Amber",
    "#EAB308": "Yellow",
    "#84CC16": "Lime",
    "#22C55E": "Green",
    "#10B981": "Emerald",
    "#14B8A6": "Teal",
    "#06B6D4": "Cyan",
    "#0EA5E9": "Sky",
    "#3B82F6": "Blue",
    "#6366F1": "Indigo",
    "#8B5CF6": "Violet",
    "#A855F7": "Purple",
    "#D946EF": "Fuchsia",
    "#EC4899": "Pink",
    "#F43F5E": "Rose",
  };

  const normalizedHex = hex.toUpperCase().startsWith("#")
    ? hex.toUpperCase()
    : `#${hex.toUpperCase()}`;

  return colorMap[normalizedHex] || "Custom";
}
