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
  | "schemas"
  | "templates"
  | "schema_field_items"
  | "template_array_items"
  | "template_values";
