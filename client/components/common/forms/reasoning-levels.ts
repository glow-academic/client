/**
 * Reasoning level definitions for model configuration
 * Extracted from ReasoningLevelPicker for reuse
 */

export const REASONING_LEVELS = [
  { id: "none", name: "None", description: "No extended reasoning" },
  {
    id: "minimal",
    name: "Minimal",
    description: "Basic reasoning for straightforward tasks",
  },
  {
    id: "low",
    name: "Low",
    description: "Light reasoning for simple problem-solving",
  },
  {
    id: "medium",
    name: "Medium",
    description: "Balanced reasoning for moderate complexity",
  },
  {
    id: "high",
    name: "High",
    description: "Deep reasoning for complex, multi-step problems",
  },
] as const;

export type ReasoningLevel = (typeof REASONING_LEVELS)[number]["id"];
