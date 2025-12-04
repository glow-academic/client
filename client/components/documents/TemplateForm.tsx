/**
 * TemplateForm.tsx
 * Dynamic form generator based on template schema
 */

"use client";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Minus, Trash2 } from "lucide-react";

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

export interface TemplateFormProps {
  schema: TemplateSchema | null;
  values: Record<string, any>;
  onChange: (values: Record<string, any>) => void;
}

export default function TemplateForm({
  schema,
  values,
  onChange,
}: TemplateFormProps) {
  const [formValues, setFormValues] = useState<Record<string, any>>(values);

  useEffect(() => {
    setFormValues(values);
  }, [values]);

  const updateValue = (path: string[], value: any) => {
    const newValues = { ...formValues };
    let current: any = newValues;

    // Navigate to the nested path
    for (let i = 0; i < path.length - 1; i++) {
      if (!current[path[i]]) {
        current[path[i]] = {};
      }
      current = current[path[i]];
    }

    // Set the final value
    current[path[path.length - 1]] = value;
    setFormValues(newValues);
    onChange(newValues);
  };

  const renderField = (
    field: TemplateField,
    path: string[] = [],
    indent: number = 0
  ): JSX.Element | null => {
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
              value={fieldValue || ""}
              onChange={(e) =>
                updateValue(fieldPath, e.target.value)
              }
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
              value={fieldValue || ""}
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
              checked={fieldValue || false}
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
            {arrayValue.map((item: any, index: number) => (
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
                          (_: any, i: number) => i !== index
                        );
                        updateValue(fieldPath, newArray);
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {renderField(field.item!, [...fieldPath, index.toString()], indent + 1)}
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

  const getNestedValue = (obj: any, path: string[]): any => {
    let current = obj;
    for (const key of path) {
      if (current === undefined || current === null) {
        return undefined;
      }
      current = current[key];
    }
    return current;
  };

  const getDefaultValue = (field: TemplateField): any => {
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
        const obj: Record<string, any> = {};
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

