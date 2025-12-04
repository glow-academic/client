/**
 * Template Args URL Serialization Utility
 * Serializes/deserializes template arguments to/from URL search params
 * using flattened dot notation (e.g., items.0.name=Item1)
 */

import type { TemplateSchema } from "@/components/documents/TemplateForm";

/**
 * Flatten template arguments into URL search params using dot notation.
 * 
 * Examples:
 * - {title: "Test"} → title=Test
 * - {user: {name: "John"}} → user.name=John
 * - {items: [{name: "Item1"}]} → items.0.name=Item1
 * - {items: [{name: "Item1"}, {name: "Item2"}]} → items.0.name=Item1&items.1.name=Item2
 */
export function templateArgsToSearchParams(
  args: Record<string, any>
): URLSearchParams {
  const params = new URLSearchParams();

  function flatten(obj: any, prefix = ""): void {
    if (obj === null || obj === undefined) {
      return; // Skip null/undefined values
    }

    if (typeof obj === "object" && !Array.isArray(obj)) {
      // Handle objects
      for (const [key, value] of Object.entries(obj)) {
        const newKey = prefix ? `${prefix}.${key}` : key;
        if (value === null || value === undefined) {
          continue; // Skip null/undefined
        } else if (typeof value === "object" && !Array.isArray(value)) {
          flatten(value, newKey);
        } else if (Array.isArray(value)) {
          flatten(value, newKey);
        } else {
          params.set(newKey, String(value));
        }
      }
    } else if (Array.isArray(obj)) {
      // Handle arrays
      obj.forEach((item, index) => {
        const newKey = `${prefix}.${index}`;
        if (item === null || item === undefined) {
          return; // Skip null/undefined array items
        } else if (typeof item === "object" && !Array.isArray(item)) {
          flatten(item, newKey);
        } else if (Array.isArray(item)) {
          flatten(item, newKey);
        } else {
          params.set(newKey, String(item));
        }
      });
    } else {
      // Primitive value
      params.set(prefix, String(obj));
    }
  }

  flatten(args);
  return params;
}

/**
 * Reconstruct template arguments from URL search params using schema for type information.
 * 
 * Examples:
 * - title=Test → {title: "Test"}
 * - user.name=John → {user: {name: "John"}}
 * - items.0.name=Item1 → {items: [{name: "Item1"}]}
 */
export function searchParamsToTemplateArgs(
  params: URLSearchParams,
  schema: TemplateSchema | null
): Record<string, any> {
  if (!schema || !schema.fields || schema.fields.length === 0) {
    return {};
  }

  const result: Record<string, any> = {};

  // Helper to get field type from schema
  function getFieldType(path: string[]): string | null {
    let currentFields = schema!.fields;
    for (let i = 0; i < path.length; i++) {
      const fieldName = path[i];
      const field = currentFields.find((f) => f.name === fieldName);
      if (!field) return null;

      if (i === path.length - 1) {
        return field.type;
      }

      if (field.type === "object" && field.fields) {
        currentFields = field.fields;
      } else if (field.type === "array" && field.item) {
        if (field.item.type === "object" && field.item.fields) {
          currentFields = field.item.fields;
        } else {
          return field.item.type;
        }
      } else {
        return null;
      }
    }
    return null;
  }

  // Helper to set nested value
  function setNestedValue(obj: any, path: string[], value: any): void {
    let current = obj;
    let i = 0;
    
    while (i < path.length - 1) {
      const key = path[i];
      const nextKey = path[i + 1];
      
      // Check if next key is numeric (array index)
      const isArrayIndex = /^\d+$/.test(nextKey);
      
      if (isArrayIndex) {
        // We're entering an array
        if (!current[key] || !Array.isArray(current[key])) {
          current[key] = [];
        }
        const index = parseInt(nextKey, 10);
        // Ensure array is large enough
        while (current[key].length <= index) {
          current[key].push({});
        }
        current = current[key][index];
        i += 2; // Skip both the key and the index
      } else {
        // We're entering an object
        if (!current[key] || typeof current[key] !== "object" || Array.isArray(current[key])) {
          current[key] = {};
        }
        current = current[key];
        i++;
      }
    }

    // Set the final value
    const finalKey = path[path.length - 1];
    const parentPath = path.slice(0, -1);
    const fieldType = getFieldType(parentPath);
    
    // Convert value based on type
    let convertedValue: any = value;
    if (fieldType === "number") {
      convertedValue = parseFloat(value);
      if (isNaN(convertedValue)) convertedValue = 0;
    } else if (fieldType === "boolean") {
      convertedValue = value === "true";
    }

    // Check if final key is numeric (array index)
    if (/^\d+$/.test(finalKey)) {
      const index = parseInt(finalKey, 10);
      if (!Array.isArray(current)) {
        // This shouldn't happen, but handle it gracefully
        current = [];
      }
      // Ensure array is large enough
      while (current.length <= index) {
        current.push(undefined);
      }
      current[index] = convertedValue;
    } else {
      current[finalKey] = convertedValue;
    }
  }

  // Parse all params
  for (const [key, value] of params.entries()) {
    // Skip non-template-arg params
    if (!key.includes(".") && !schema.fields.some((f) => f.name === key)) {
      continue;
    }

    const path = key.split(".");
    
    // Handle root-level fields (no dots)
    if (path.length === 1) {
      const field = schema.fields.find((f) => f.name === path[0]);
      if (field) {
        let convertedValue: any = value;
        if (field.type === "number") {
          convertedValue = parseFloat(value);
          if (isNaN(convertedValue)) convertedValue = 0;
        } else if (field.type === "boolean") {
          convertedValue = value === "true";
        }
        result[path[0]] = convertedValue;
      }
    } else {
      // Handle nested paths
      setNestedValue(result, path, value);
    }
  }

  // Ensure arrays are properly initialized
  function ensureArrays(obj: any, fields: typeof schema.fields): void {
    for (const field of fields) {
      if (field.type === "array") {
        if (!obj[field.name] || !Array.isArray(obj[field.name])) {
          obj[field.name] = [];
        }
        if (field.item && field.item.type === "object" && field.item.fields) {
          obj[field.name].forEach((item: any) => {
            ensureArrays(item, field.item!.fields!);
          });
        }
      } else if (field.type === "object" && field.fields) {
        if (obj[field.name] && typeof obj[field.name] === "object") {
          ensureArrays(obj[field.name], field.fields);
        }
      }
    }
  }

  ensureArrays(result, schema.fields);

  return result;
}

