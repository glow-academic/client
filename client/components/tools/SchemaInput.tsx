/**
 * SchemaInput.tsx
 * Component for editing argument schema fields
 * Follows Names.tsx / Descriptions.tsx pattern - manages own state, calls save actions directly
 */

"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type CreateSchemaFieldIn = InputOf<"/api/v4/resources/schema_fields", "post">;
type CreateSchemaFieldOut = OutputOf<"/api/v4/resources/schema_fields", "post">;

export interface SchemaFieldDetail {
  schema_field_id: string;
  schema_id: string;
  name: string;
  field_type: string;
  required: boolean;
  description: string;
  template: string;
  position: number;
  default_value: string;
  generated: boolean;
}

export interface Domain {
  domain_id: string;
  resource: string;
  generated: boolean;
}

export interface SchemaInputProps {
  schema_ids: string[]; // From Tool.tsx formState - which schemas are selected
  input_schema_fields: SchemaFieldDetail[]; // From API - detailed field data for selected schemas
  domain_resources: Domain[]; // From API - domain connections for context (read-only)
  disabled: boolean; // Based on can_edit flag from Tool.tsx
  // Note: schema_ids selection is managed by Tool.tsx in separate "schemas" step
  // This component only edits fields within selected schemas
  createSchemaFieldAction?: (
    input: CreateSchemaFieldIn
  ) => Promise<CreateSchemaFieldOut>;
  group_id?: string | null; // Group ID for resource creation
  agent_id?: string | null; // Agent ID for resource creation
  // Component handles field changes internally and calls saveSchemaFieldAction
  // No onChange callback needed - component manages its own state like Names/Descriptions
}

export function SchemaInput({
  schema_ids,
  input_schema_fields,
  domain_resources,
  disabled = false,
  createSchemaFieldAction,
  group_id,
  agent_id,
}: SchemaInputProps) {
  // Group fields by schema_id
  const fieldsBySchema = useMemo(() => {
    const grouped: Record<string, SchemaFieldDetail[]> = {};
    input_schema_fields.forEach((field) => {
      const schemaId = field.schema_id;
      if (!grouped[schemaId]) {
        grouped[schemaId] = [];
      }
      grouped[schemaId]!.push(field);
    });
    // Sort fields within each schema by position
    Object.keys(grouped).forEach((schemaId) => {
      const fields = grouped[schemaId];
      if (fields) {
        grouped[schemaId] = fields.sort((a, b) => a.position - b.position);
      }
    });
    return grouped;
  }, [input_schema_fields]);

  // Internal state for field values (like Names.tsx internalValue)
  const [fieldValues, setFieldValues] = useState<
    Record<string, Partial<SchemaFieldDetail>>
  >({});
  const debounceTimerRef = useRef<Record<string, NodeJS.Timeout>>({});
  const lastSavedValuesRef = useRef<Record<string, Partial<SchemaFieldDetail>>>(
    {}
  );
  const isInitialMountRef = useRef(true);

  // Initialize field values from props
  useEffect(() => {
    if (isInitialMountRef.current) {
      const initialValues: Record<string, Partial<SchemaFieldDetail>> = {};
      input_schema_fields.forEach((field) => {
        initialValues[field.schema_field_id] = {
          name: field.name,
          field_type: field.field_type,
          required: field.required,
          description: field.description,
          template: field.template,
          position: field.position,
          default_value: field.default_value,
        };
      });
      setFieldValues(initialValues);
      lastSavedValuesRef.current = initialValues;
      isInitialMountRef.current = false;
    }
  }, [input_schema_fields]);

  // Sync field values when props change (like Names.tsx syncs with resourceName)
  useEffect(() => {
    const newValues: Record<string, Partial<SchemaFieldDetail>> = {};
    let hasChanges = false;
    input_schema_fields.forEach((field) => {
      const currentValue = lastSavedValuesRef.current[field.schema_field_id];
      // Only update if prop value differs from last saved value
      if (
        !currentValue ||
        currentValue.name !== field.name ||
        currentValue.field_type !== field.field_type ||
        currentValue.required !== field.required ||
        currentValue.description !== field.description ||
        currentValue.template !== field.template ||
        currentValue.position !== field.position ||
        currentValue.default_value !== field.default_value
      ) {
        newValues[field.schema_field_id] = {
          name: field.name,
          field_type: field.field_type,
          required: field.required,
          description: field.description,
          template: field.template,
          position: field.position,
          default_value: field.default_value,
        };
        hasChanges = true;
      } else {
        newValues[field.schema_field_id] = currentValue;
      }
    });
    if (hasChanges) {
      setFieldValues(newValues);
      lastSavedValuesRef.current = newValues;
    }
  }, [input_schema_fields]);

  // Debounced save function (like Names.tsx debounced resource creation)
  // For updates, we create a new schema_field resource (write-only pattern)
  const saveField = useCallback(
    async (fieldId: string, updates: Partial<SchemaFieldDetail>) => {
      if (!createSchemaFieldAction || !agent_id || !group_id) return;

      const field = input_schema_fields.find(
        (f) => f.schema_field_id === fieldId
      );
      if (!field) return;

      try {
        // Create new schema_field resource with updated values (write-only pattern)
        await createSchemaFieldAction({
          body: {
            agent_id: agent_id,
            group_id: group_id,
            schema_id: field.schema_id,
            name: updates.name ?? field.name,
            field_type: (updates.field_type ?? field.field_type) as
              | "string"
              | "number"
              | "boolean"
              | "array",
            required: updates.required ?? field.required,
            position_value: updates.position ?? field.position,
            template: updates.template ?? field.template,
            description: updates.description ?? field.description,
            default_value: updates.default_value ?? field.default_value,
            mcp: false,
          },
        });
        // Update last saved value
        lastSavedValuesRef.current[fieldId] = {
          ...lastSavedValuesRef.current[fieldId],
          ...updates,
        };
        // Note: The new schema_field will be linked to the schema automatically
        // The old one remains but new one is created (write-only pattern)
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error("Failed to create schema field:", error);
        // Could add toast notification here
      }
    },
    [createSchemaFieldAction, input_schema_fields, agent_id, group_id]
  );

  // Handle field value change with debouncing
  const handleFieldChange = useCallback(
    (
      fieldId: string,
      key: keyof SchemaFieldDetail,
      value: string | number | boolean
    ) => {
      setFieldValues((prev) => ({
        ...prev,
        [fieldId]: {
          ...prev[fieldId],
          [key]: value,
        },
      }));

      // Clear existing timer for this field
      if (debounceTimerRef.current[fieldId]) {
        clearTimeout(debounceTimerRef.current[fieldId]);
      }

      // Set new timer (500ms debounce like Names.tsx)
      debounceTimerRef.current[fieldId] = setTimeout(() => {
        const currentValue = fieldValues[fieldId];
        const lastSaved = lastSavedValuesRef.current[fieldId];
        // Only save if value actually changed
        if (
          !lastSaved ||
          lastSaved[key] !== value ||
          JSON.stringify(currentValue) !== JSON.stringify(lastSaved)
        ) {
          saveField(fieldId, { [key]: value });
        }
      }, 500);
    },
    [fieldValues, saveField]
  );

  // Cleanup timers on unmount
  useEffect(() => {
    const timers = debounceTimerRef.current;
    return () => {
      Object.values(timers).forEach((timer) => {
        if (timer) clearTimeout(timer);
      });
    };
  }, []);

  // Don't render if no schemas selected
  if (schema_ids.length === 0) {
    return (
      <div className="text-sm text-muted-foreground p-4">
        No schemas selected. Select schemas in the "Schemas" step to edit their
        fields.
      </div>
    );
  }

  // Don't render if no fields
  if (input_schema_fields.length === 0) {
    return (
      <div className="text-sm text-muted-foreground p-4">
        No schema fields found for selected schemas.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Domain connections display (read-only) */}
      {domain_resources.length > 0 && (
        <div className="rounded-md border p-4 bg-muted/50">
          <Label className="text-sm font-medium mb-2">Domain Connections</Label>
          <div className="flex flex-wrap gap-2">
            {domain_resources.map((domain) => (
              <span
                key={domain.domain_id}
                className="text-xs px-2 py-1 rounded bg-background border"
              >
                {domain.resource}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Fields grouped by schema */}
      {Object.entries(fieldsBySchema).map(([schemaId, fields]) => (
        <div key={schemaId} className="space-y-4">
          <div className="border rounded-md p-4">
            <Label className="text-base font-semibold mb-4">
              Schema: {schemaId.slice(0, 8)}...
            </Label>
            <div className="space-y-4">
              {fields.map((field) => {
                const fieldValue = fieldValues[field.schema_field_id] ?? {};
                return (
                  <div
                    key={field.schema_field_id}
                    className="border rounded p-4 space-y-3"
                  >
                    <div className="grid grid-cols-2 gap-4">
                      {/* Field Name */}
                      <div className="space-y-2">
                        <Label htmlFor={`${field.schema_field_id}-name`}>
                          Field Name
                        </Label>
                        <Input
                          id={`${field.schema_field_id}-name`}
                          value={fieldValue.name ?? field.name}
                          onChange={(e) =>
                            handleFieldChange(
                              field.schema_field_id,
                              "name",
                              e.target.value
                            )
                          }
                          disabled={disabled}
                          placeholder="Field name"
                        />
                      </div>

                      {/* Field Type */}
                      <div className="space-y-2">
                        <Label htmlFor={`${field.schema_field_id}-type`}>
                          Type
                        </Label>
                        <Select
                          value={fieldValue.field_type ?? field.field_type}
                          onValueChange={(value) =>
                            handleFieldChange(
                              field.schema_field_id,
                              "field_type",
                              value
                            )
                          }
                          disabled={disabled}
                        >
                          <SelectTrigger id={`${field.schema_field_id}-type`}>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="string">String</SelectItem>
                            <SelectItem value="number">Number</SelectItem>
                            <SelectItem value="boolean">Boolean</SelectItem>
                            <SelectItem value="array">Array</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Required Checkbox */}
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id={`${field.schema_field_id}-required`}
                        checked={fieldValue.required ?? field.required}
                        onCheckedChange={(checked) =>
                          handleFieldChange(
                            field.schema_field_id,
                            "required",
                            checked === true
                          )
                        }
                        disabled={disabled}
                      />
                      <Label
                        htmlFor={`${field.schema_field_id}-required`}
                        className="text-sm font-normal cursor-pointer"
                      >
                        Required
                      </Label>
                    </div>

                    {/* Description */}
                    <div className="space-y-2">
                      <Label htmlFor={`${field.schema_field_id}-description`}>
                        Description
                      </Label>
                      <Textarea
                        id={`${field.schema_field_id}-description`}
                        value={fieldValue.description ?? field.description}
                        onChange={(e) =>
                          handleFieldChange(
                            field.schema_field_id,
                            "description",
                            e.target.value
                          )
                        }
                        disabled={disabled}
                        placeholder="Field description"
                        rows={2}
                      />
                    </div>

                    {/* Template (Jinja) */}
                    <div className="space-y-2">
                      <Label htmlFor={`${field.schema_field_id}-template`}>
                        Template (Jinja)
                      </Label>
                      <Textarea
                        id={`${field.schema_field_id}-template`}
                        value={fieldValue.template ?? field.template}
                        onChange={(e) =>
                          handleFieldChange(
                            field.schema_field_id,
                            "template",
                            e.target.value
                          )
                        }
                        disabled={disabled}
                        placeholder="{{ field_name }}"
                        rows={2}
                      />
                    </div>

                    {/* Position and Default Value */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor={`${field.schema_field_id}-position`}>
                          Position
                        </Label>
                        <Input
                          id={`${field.schema_field_id}-position`}
                          type="number"
                          value={fieldValue.position ?? field.position}
                          onChange={(e) =>
                            handleFieldChange(
                              field.schema_field_id,
                              "position",
                              parseInt(e.target.value, 10) || 0
                            )
                          }
                          disabled={disabled}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label
                          htmlFor={`${field.schema_field_id}-default_value`}
                        >
                          Default Value
                        </Label>
                        <Input
                          id={`${field.schema_field_id}-default_value`}
                          value={
                            fieldValue.default_value ?? field.default_value
                          }
                          onChange={(e) =>
                            handleFieldChange(
                              field.schema_field_id,
                              "default_value",
                              e.target.value
                            )
                          }
                          disabled={disabled}
                          placeholder="Default value"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
