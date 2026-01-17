/**
 * Resource types matching the database resources enum
 * Used for AI generation state management and type safety
 */
export type ResourceType =
  | "names"
  | "descriptions"
  | "colors"
  | "icons"
  | "instructions"
  | "flags"
  | "examples"
  | "fields"
  | "departments"
  | "scenarios"
  | "scenario_flags"
  | "scenario_positions"
  | "scenario_rubric_grade_agents"
  | "templates"
  | "uploads"
  | "models"
  | "prompts"
  | "reasoning_levels"
  | "temperature_levels"
  | "voices"
  | "tools";
