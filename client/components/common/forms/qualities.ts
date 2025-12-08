/**
 * Quality level definitions for image models
 * Extracted from QualityPicker for reuse
 */

export const QUALITIES = [
  { id: "low", name: "Low", description: "Lower quality, faster generation" },
  {
    id: "medium",
    name: "Medium",
    description: "Balanced quality and speed",
  },
  {
    id: "high",
    name: "High",
    description: "Highest quality, slower generation",
  },
] as const;

export type Quality = (typeof QUALITIES)[number]["id"];
