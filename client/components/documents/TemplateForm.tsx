/**
 * TemplateForm.tsx
 * Dynamic form generator based on template schema
 */

"use client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { templateArgsToSearchParams } from "@/utils/template-args-url";
import { Plus, Trash2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

export interface TemplateField {
  name: string;
  type: "string" | "number" | "boolean" | "array" | "object";
  required?: boolean;
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
  values: Record<string, unknown>;
  onChange: (values: Record<string, unknown>) => void;
}

export default function TemplateForm({
  schema,
  values,
  onChange,
}: TemplateFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [formValues, setFormValues] = useState<Record<string, unknown>>(values);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize form values from search params on mount
  useEffect(() => {
    if (schema && searchParams) {
      // Check if there are any template arg params in URL
      const hasTemplateParams = Array.from(searchParams.keys()).some(
        (key) => key.includes(".") || schema.fields.some((f) => f.name === key)
      );

      if (hasTemplateParams) {
        // Import searchParamsToTemplateArgs dynamically to avoid circular deps
        import("@/utils/template-args-url").then(
          ({ searchParamsToTemplateArgs }) => {
            const urlArgs = searchParamsToTemplateArgs(searchParams, schema);
            if (Object.keys(urlArgs).length > 0) {
              setFormValues(urlArgs);
              onChange(urlArgs);
            }
          }
        );
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on mount - schema and searchParams are stable

  // Sync form values to URL search params with debouncing
  const syncToUrl = useCallback(
    (newValues: Record<string, unknown>) => {
      if (!schema) return;

      // Clear existing timeout
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }

      // Debounce URL updates (300ms)
      debounceTimeoutRef.current = setTimeout(() => {
        const params = new URLSearchParams(searchParams.toString());

        // Remove existing template arg params
        const keysToRemove: string[] = [];
        for (const key of params.keys()) {
          if (key.includes(".") || schema.fields.some((f) => f.name === key)) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach((key) => params.delete(key));

        // Add new template arg params
        const templateParams = templateArgsToSearchParams(newValues);
        for (const [key, value] of templateParams.entries()) {
          params.set(key, value);
        }

        // Update URL without scrolling
        router.replace(`?${params.toString()}`, { scroll: false });
      }, 300);
    },
    [schema, searchParams, router]
  );

  useEffect(() => {
    setFormValues(values);
  }, [values]);

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
    setFormValues(newValues);
    onChange(newValues);
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
            <Textarea
              id={fieldPath.join(".")}
              value={typeof fieldValue === "string" ? fieldValue : ""}
              onChange={(e) => updateValue(fieldPath, e.target.value)}
              placeholder={`Enter ${field.name}`}
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
              placeholder={`Enter ${field.name}`}
            />
          </div>
        );

      case "boolean":
        return (
          <div
            key={field.name}
            className="flex items-center space-x-2"
            style={{ paddingLeft }}
          >
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
        );

      case "array":
        if (!field.item) return null;
        const arrayValue = Array.isArray(fieldValue) ? fieldValue : [];

        return (
          <div key={field.name} className="space-y-2" style={{ paddingLeft }}>
            <div className="flex items-center justify-between">
              <Label>
                {field.name}
                {field.required && <span className="text-destructive"> *</span>}
              </Label>
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
              <Card key={index} className="relative">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">
                      {field.name} #{index + 1}
                    </CardTitle>
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
                </CardHeader>
                <CardContent className="space-y-4">
                  {renderField(
                    field.item!,
                    [...fieldPath, index.toString()],
                    indent + 1
                  )}
                </CardContent>
              </Card>
            ))}
            {arrayValue.length === 0 && (
              <div className="text-sm text-muted-foreground p-4 border rounded-md">
                No items. Click "Add Item" to add one.
              </div>
            )}
          </div>
        );

      case "object":
        if (!field.fields) return null;
        return (
          <div key={field.name} className="space-y-4" style={{ paddingLeft }}>
            <Label>
              {field.name}
              {field.required && <span className="text-destructive"> *</span>}
            </Label>
            <Card>
              <CardContent className="pt-6 space-y-4">
                {field.fields.map((subField) =>
                  renderField(subField, fieldPath, indent + 1)
                )}
              </CardContent>
            </Card>
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
