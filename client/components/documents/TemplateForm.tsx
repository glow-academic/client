/**
 * TemplateForm.tsx
 * Dynamic form generator based on template schema
 */

"use client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  searchParamsToTemplateArgs,
  templateArgsToSearchParams,
} from "@/utils/template-args-url";
import { Plus, Trash2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

export interface TemplateField {
  name: string;
  type: "string" | "number" | "boolean" | "array" | "object";
  required?: boolean;
  description?: string; // Human-readable description of what this field represents
  placeholder?: string; // Example value or placeholder text
  item?: TemplateField; // For array items
  fields?: TemplateField[]; // For object fields
}

export interface TemplateSchema {
  name: string;
  fields: TemplateField[];
}

// Type guard to validate template_schema structure
// Exported for use in Document.tsx
export function isTemplateSchema(value: unknown): value is TemplateSchema {
  if (!value || typeof value !== "object") return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj["name"] === "string" &&
    Array.isArray(obj["fields"]) &&
    (obj["fields"] as unknown[]).every(
      (field: unknown) =>
        typeof field === "object" &&
        field !== null &&
        "name" in field &&
        "type" in field
    )
  );
}

export interface TemplateFormProps {
  schema: TemplateSchema | null;
  // values and onChange are kept for backward compatibility but not used
  // Search params are now the single source of truth
  values?: Record<string, unknown>;
  onChange?: (values: Record<string, unknown>) => void;
}

export default function TemplateForm({
  schema,
  values: _values,
  onChange: _onChange,
}: TemplateFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Helper to get template args from URL search params
  const getUrlArgs = useCallback(() => {
    if (!schema || !searchParams) return {};
    return searchParamsToTemplateArgs(searchParams, schema);
  }, [schema, searchParams]);

  // Initialize form values from URL search params (single source of truth)
  const [formValues, setFormValues] = useState<Record<string, unknown>>(() => {
    if (!schema || !searchParams) return {};
    return searchParamsToTemplateArgs(searchParams, schema);
  });

  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isUpdatingUrlRef = useRef(false);

  // Keep local state in sync if URL changes (back/forward, link, etc.)
  // This follows the SimulationHistory pattern - sync directly without comparison
  useEffect(() => {
    if (!schema || !searchParams) return;

    // Skip if we're the ones updating the URL (avoid circular updates)
    if (isUpdatingUrlRef.current) {
      return;
    }

    const urlArgs = getUrlArgs();
    setFormValues(urlArgs);
  }, [searchParams, schema, getUrlArgs]);

  // Sync form values to URL search params with debouncing
  const syncToUrl = useCallback(
    (newValues: Record<string, unknown>) => {
      if (!schema) return;

      // Clear existing timeout
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }

      // Mark that we're updating the URL
      isUpdatingUrlRef.current = true;

      // Debounce URL updates (500ms to match render debounce)
      debounceTimeoutRef.current = setTimeout(() => {
        const params = new URLSearchParams(searchParams.toString());

        // Remove existing template args param (JSON format)
        params.delete("templateArgs");

        // Also clean up any old dot notation params for backward compatibility
        const keysToRemove: string[] = [];
        for (const key of params.keys()) {
          if (key.includes(".") || schema.fields.some((f) => f.name === key)) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach((key) => params.delete(key));

        // Add new template args as JSON
        const templateParams = templateArgsToSearchParams(newValues);
        for (const [key, value] of templateParams.entries()) {
          params.set(key, value);
        }

        // Update URL without scrolling (this will trigger soft refresh)
        router.replace(`?${params.toString()}`, { scroll: false });

        // Clear flag after URL update completes
        // Next.js soft refresh will cause searchParams to update, which will sync formValues
        setTimeout(() => {
          isUpdatingUrlRef.current = false;
        }, 100);
      }, 500);
    },
    [schema, searchParams, router]
  );

  const updateValue = (path: string[], value: unknown) => {
    const newValues = { ...formValues };
    let current: Record<string, unknown> = newValues;

    // Navigate to the nested path
    for (let i = 0; i < path.length - 1; i++) {
      const key = path[i];
      if (key === undefined) break;
      if (
        !current[key] ||
        typeof current[key] !== "object" ||
        current[key] === null
      ) {
        current[key] = {};
      }
      current = current[key] as Record<string, unknown>;
    }

    // Set the final value
    const finalKey = path[path.length - 1];
    if (finalKey !== undefined) {
      current[finalKey] = value;
    }

    // Update local state immediately for responsive UI (like SimulationHistory pattern)
    setFormValues(newValues);

    // Sync to URL with debounce (this will trigger soft refresh and re-render)
    syncToUrl(newValues);
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, []);

  const renderField = (
    field: TemplateField,
    path: string[] = [],
    indent: number = 0
  ): React.JSX.Element | null => {
    const fieldPath = [...path, field.name];
    const fieldValue = getNestedValue(formValues, fieldPath);
    const paddingLeft = indent * 24;

    switch (field.type) {
      case "string":
        return (
          <div key={field.name} className="space-y-2" style={{ paddingLeft }}>
            <Label htmlFor={fieldPath.join(".")}>
              {field.name}
              {field.required && <span className="text-destructive"> *</span>}
            </Label>
            {field.description && (
              <p className="text-sm text-muted-foreground">
                {field.description}
              </p>
            )}
            <Textarea
              id={fieldPath.join(".")}
              value={typeof fieldValue === "string" ? fieldValue : ""}
              onChange={(e) => updateValue(fieldPath, e.target.value)}
              placeholder={field.placeholder || `Enter ${field.name}`}
              rows={3}
            />
          </div>
        );

      case "number":
        return (
          <div key={field.name} className="space-y-2" style={{ paddingLeft }}>
            <Label htmlFor={fieldPath.join(".")}>
              {field.name}
              {field.required && <span className="text-destructive"> *</span>}
            </Label>
            {field.description && (
              <p className="text-sm text-muted-foreground">
                {field.description}
              </p>
            )}
            <Input
              id={fieldPath.join(".")}
              type="number"
              value={
                typeof fieldValue === "number"
                  ? fieldValue
                  : typeof fieldValue === "string"
                    ? fieldValue
                    : ""
              }
              onChange={(e) =>
                updateValue(
                  fieldPath,
                  e.target.value ? parseFloat(e.target.value) : undefined
                )
              }
              placeholder={field.placeholder || `Enter ${field.name}`}
            />
          </div>
        );

      case "boolean":
        return (
          <div key={field.name} className="space-y-2" style={{ paddingLeft }}>
            <div className="flex items-center space-x-2">
              <Checkbox
                id={fieldPath.join(".")}
                checked={typeof fieldValue === "boolean" ? fieldValue : false}
                onCheckedChange={(checked) =>
                  updateValue(fieldPath, checked === true)
                }
              />
              <Label htmlFor={fieldPath.join(".")}>
                {field.name}
                {field.required && <span className="text-destructive"> *</span>}
              </Label>
            </div>
            {field.description && (
              <p className="text-sm text-muted-foreground ml-6">
                {field.description}
              </p>
            )}
          </div>
        );

      case "array":
        if (!field.item) return null;
        const arrayValue = Array.isArray(fieldValue) ? fieldValue : [];

        return (
          <div key={field.name} className="space-y-2" style={{ paddingLeft }}>
            <div className="flex items-center justify-between">
              <div>
                <Label>
                  {field.name}
                  {field.required && (
                    <span className="text-destructive"> *</span>
                  )}
                </Label>
                {field.description && (
                  <p className="text-sm text-muted-foreground">
                    {field.description}
                  </p>
                )}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const newItem = getDefaultValue(field.item!);
                  updateValue(fieldPath, [...arrayValue, newItem]);
                }}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Item
              </Button>
            </div>
            {arrayValue.map((_item: unknown, index: number) => (
              <div key={index} className="relative p-4 space-y-4">
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-sm font-medium">
                    {field.name} #{index + 1}
                  </Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const newArray = arrayValue.filter(
                        (_: unknown, i: number) => i !== index
                      );
                      updateValue(fieldPath, newArray);
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
                {renderField(
                  field.item!,
                  [...fieldPath, index.toString()],
                  indent + 1
                )}
              </div>
            ))}
            {arrayValue.length === 0 && (
              <div className="text-sm text-muted-foreground p-4">
                No items. Click "Add Item" to add one.
              </div>
            )}
          </div>
        );

      case "object":
        if (!field.fields) return null;
        return (
          <div key={field.name} className="space-y-4" style={{ paddingLeft }}>
            <div>
              <Label>
                {field.name}
                {field.required && <span className="text-destructive"> *</span>}
              </Label>
              {field.description && (
                <p className="text-sm text-muted-foreground">
                  {field.description}
                </p>
              )}
            </div>
            <div className="space-y-4">
              {field.fields.map((subField) =>
                renderField(subField, fieldPath, indent + 1)
              )}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const getNestedValue = (
    obj: Record<string, unknown>,
    path: string[]
  ): unknown => {
    let current: unknown = obj;
    for (const key of path) {
      if (
        current === undefined ||
        current === null ||
        typeof current !== "object"
      ) {
        return undefined;
      }
      current = (current as Record<string, unknown>)[key];
    }
    return current;
  };

  const getDefaultValue = (field: TemplateField): unknown => {
    switch (field.type) {
      case "string":
        return "";
      case "number":
        return 0;
      case "boolean":
        return false;
      case "array":
        return [];
      case "object":
        const obj: Record<string, unknown> = {};
        if (field.fields) {
          field.fields.forEach((f) => {
            obj[f.name] = getDefaultValue(f);
          });
        }
        return obj;
      default:
        return undefined;
    }
  };

  if (!schema || !schema.fields || schema.fields.length === 0) {
    return (
      <div className="text-sm text-muted-foreground p-4">
        No template schema available. Generate a template to see form fields.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {schema.fields.map((field) => renderField(field))}
    </div>
  );
}
