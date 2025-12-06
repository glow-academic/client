/**
 * Template Args URL Serialization Utility
 * Serializes/deserializes template arguments to/from URL search params
 * using JSON serialization (e.g., templateArgs=%7B%22items%22%3A...)
 */

import type { TemplateSchema } from "@/components/documents/TemplateForm";

const TEMPLATE_ARGS_PARAM = "templateArgs";

/**
 * Serialize template arguments to URL search params using JSON.
 * 
 * Examples:
 * - {title: "Test"} → templateArgs=%7B%22title%22%3A%22Test%22%7D
 * - {user: {name: "John"}} → templateArgs=%7B%22user%22%3A%7B%22name%22%3A%22John%22%7D%7D
 * - {items: [{name: "Item1"}]} → templateArgs=%7B%22items%22%3A%5B%7B%22name%22%3A%22Item1%22%7D%5D%7D
 */
export function templateArgsToSearchParams(
  args: Record<string, any>
): URLSearchParams {
  const params = new URLSearchParams();
  
  // Serialize to JSON and URL encode
  const jsonString = JSON.stringify(args);
  params.set(TEMPLATE_ARGS_PARAM, jsonString);
  
  return params;
}

/**
 * Reconstruct template arguments from URL search params using JSON deserialization.
 * 
 * Examples:
 * - templateArgs=%7B%22title%22%3A%22Test%22%7D → {title: "Test"}
 * - templateArgs=%7B%22user%22%3A%7B%22name%22%3A%22John%22%7D%7D → {user: {name: "John"}}
 * - templateArgs=%7B%22items%22%3A%5B%7B%22name%22%3A%22Item1%22%7D%5D%7D → {items: [{name: "Item1"}]}
 * 
 * Note: Schema parameter is kept for backward compatibility but is not used for parsing.
 * Type conversion is handled automatically by JSON.parse.
 */
export function searchParamsToTemplateArgs(
  params: URLSearchParams,
  schema: TemplateSchema | null
): Record<string, any> {
  const jsonString = params.get(TEMPLATE_ARGS_PARAM);
  
  if (!jsonString) {
    return {};
  }
  
  try {
    // Parse JSON - types are preserved automatically (numbers stay numbers, etc.)
    const parsed = JSON.parse(jsonString);
    
    // Validate it's an object
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return {};
    }
    
    return parsed;
  } catch (error) {
    // If JSON parsing fails, return empty object
    console.error("Failed to parse template args from URL:", error);
    return {};
  }
}
