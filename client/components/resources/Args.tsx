/**
 * Args.tsx
 * Component for editing argument fields
 * Follows SchemaInput.tsx pattern - manages own state, calls save actions directly
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

type CreateDraftArgsIn = InputOf<"/api/v4/resources/args", "post">;
type CreateDraftArgsOut = OutputOf<"/api/v4/resources/args", "post">;

export interface ArgsFieldDetail {
  args_id: string;
  name: string;
  description: string;
  field_type: string;
  required: boolean;
  default_value: string;
  position: number;
  generated: boolean;
}

export interface ArgsProps {
  args_ids: string[]; // From Tool.tsx formState - which args are selected
  input_args_fields: ArgsFieldDetail[]; // From API - detailed field data for selected args_ids
  disabled: boolean; // Based on can_edit flag from Tool.tsx
  // Note: args_ids selection is managed by Tool.tsx in separate "args" step
  // This component only edits fields within selected args
  createArgsAction?:
    | ((input: CreateDraftArgsIn) => Promise<CreateDraftArgsOut>)
    | undefined;
  group_id?: string | null; // Group ID for resource creation
  create_tool_id?: string | null; // Tool ID for AI generation/creation
  link_tool_id?: string | null; // Tool ID for AI link suggestions
  // Component handles field changes internally and calls createArgsAction
  // No onChange callback needed - component manages its own state like SchemaInput
}

export function Args({
  args_ids,
  input_args_fields,
  disabled = false,
  createArgsAction,
  group_id,
  create_tool_id,
  link_tool_id,
}: ArgsProps) {
  // Sort fields by position
  const sortedFields = useMemo(() => {
    return [...input_args_fields].sort((a, b) => a.position - b.position);
  }, [input_args_fields]);

  // Internal state for field values (like SchemaInput.tsx)
  const [fieldValues, setFieldValues] = useState<
    Record<string, Partial<ArgsFieldDetail>>
  >({});
  const debounceTimerRef = useRef<Record<string, NodeJS.Timeout>>({});
  const lastSavedValuesRef = useRef<Record<string, Partial<ArgsFieldDetail>>>(
    {}
  );
  const isInitialMountRef = useRef(true);

  // Initialize field values from props
  useEffect(() => {
    if (isInitialMountRef.current) {
      const initialValues: Record<string, Partial<ArgsFieldDetail>> = {};
      input_args_fields.forEach((field) => {
        initialValues[field.args_id] = {
          name: field.name,
          field_type: field.field_type,
          required: field.required,
          description: field.description,
          default_value: field.default_value,
          position: field.position,
        };
      });
      setFieldValues(initialValues);
      lastSavedValuesRef.current = initialValues;
      isInitialMountRef.current = false;
    }
  }, [input_args_fields]);

  // Sync field values when props change (like SchemaInput.tsx syncs with props)
  useEffect(() => {
    const newValues: Record<string, Partial<ArgsFieldDetail>> = {};
    let hasChanges = false;
    input_args_fields.forEach((field) => {
      const currentValue = lastSavedValuesRef.current[field.args_id];
      // Only update if prop value differs from last saved value
      if (
        !currentValue ||
        currentValue.name !== field.name ||
        currentValue.field_type !== field.field_type ||
        currentValue.required !== field.required ||
        currentValue.description !== field.description ||
        currentValue.position !== field.position ||
        currentValue.default_value !== field.default_value
      ) {
        newValues[field.args_id] = {
          name: field.name,
          field_type: field.field_type,
          required: field.required,
          description: field.description,
          default_value: field.default_value,
          position: field.position,
        };
        hasChanges = true;
      } else {
        newValues[field.args_id] = currentValue;
      }
    });
    if (hasChanges) {
      setFieldValues(newValues);
      lastSavedValuesRef.current = newValues;
    }
  }, [input_args_fields]);

  // Debounced save function (creates new args resource with updated values - write-only pattern)
  const saveField = useCallback(
    async (fieldId: string, updates: Partial<ArgsFieldDetail>) => {
      if (!createArgsAction || !create_tool_id || !group_id) return;

      const field = input_args_fields.find((f) => f.args_id === fieldId);
      if (!field) return;

      try {
        // Create new args resource with updated values (write-only pattern)
        await createArgsAction({
          body: {
            group_id: group_id,
            name: updates.name ?? field.name,
            description: updates.description ?? field.description,
            field_type: (updates.field_type ?? field.field_type) as
              | "string"
              | "number"
              | "boolean"
              | "array",
            required: updates.required ?? field.required,
            default_value: updates.default_value ?? field.default_value,
            position_value: updates.position ?? field.position,
            mcp: false,
          },
        });
        // Update last saved value
        lastSavedValuesRef.current[fieldId] = {
          ...lastSavedValuesRef.current[fieldId],
          ...updates,
        };
        // Note: The new args will need to be linked to the tool via tool_args junction table
        // This happens when Tool.tsx saves with the new args_id
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error("Failed to create args:", error);
        // Could add toast notification here
      }
    },
    [createArgsAction, input_args_fields, create_tool_id, group_id]
  );

  // Handle field value change with debouncing
  const handleFieldChange = useCallback(
    (
      fieldId: string,
      key: keyof ArgsFieldDetail,
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

      // Set new timer (500ms debounce like SchemaInput.tsx)
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

  // Don't render if no args selected
  if (args_ids.length === 0) {
    return (
      <div className="text-sm text-muted-foreground p-4">
        No args selected. Select args in the "Args" step to edit their fields.
      </div>
    );
  }

  // Don't render if no fields
  if (input_args_fields.length === 0) {
    return (
      <div className="text-sm text-muted-foreground p-4">
        No args fields found for selected args.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Fields */}
      {sortedFields.map((field) => {
        const fieldValue = fieldValues[field.args_id] ?? {};
        return (
          <div
            key={field.args_id}
            className="border rounded-md p-4 space-y-4"
          >
            <div className="grid grid-cols-2 gap-4">
              {/* Field Name */}
              <div className="space-y-2">
                <Label htmlFor={`${field.args_id}-name`}>Field Name</Label>
                <Input
                  id={`${field.args_id}-name`}
                  value={fieldValue.name ?? field.name}
                  onChange={(e) =>
                    handleFieldChange(field.args_id, "name", e.target.value)
                  }
                  disabled={disabled}
                  placeholder="Field name"
                />
              </div>

              {/* Field Type */}
              <div className="space-y-2">
                <Label htmlFor={`${field.args_id}-type`}>Type</Label>
                <Select
                  value={fieldValue.field_type ?? field.field_type}
                  onValueChange={(value) =>
                    handleFieldChange(field.args_id, "field_type", value)
                  }
                  disabled={disabled}
                >
                  <SelectTrigger id={`${field.args_id}-type`}>
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
                id={`${field.args_id}-required`}
                checked={fieldValue.required ?? field.required}
                onCheckedChange={(checked) =>
                  handleFieldChange(
                    field.args_id,
                    "required",
                    checked === true
                  )
                }
                disabled={disabled}
              />
              <Label
                htmlFor={`${field.args_id}-required`}
                className="text-sm font-normal cursor-pointer"
              >
                Required
              </Label>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor={`${field.args_id}-description`}>
                Description
              </Label>
              <Textarea
                id={`${field.args_id}-description`}
                value={fieldValue.description ?? field.description}
                onChange={(e) =>
                  handleFieldChange(
                    field.args_id,
                    "description",
                    e.target.value
                  )
                }
                disabled={disabled}
                placeholder="Field description"
                rows={2}
              />
            </div>

            {/* Position and Default Value */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor={`${field.args_id}-position`}>Position</Label>
                <Input
                  id={`${field.args_id}-position`}
                  type="number"
                  value={fieldValue.position ?? field.position}
                  onChange={(e) =>
                    handleFieldChange(
                      field.args_id,
                      "position",
                      parseInt(e.target.value, 10) || 0
                    )
                  }
                  disabled={disabled}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`${field.args_id}-default_value`}>
                  Default Value
                </Label>
                <Input
                  id={`${field.args_id}-default_value`}
                  value={fieldValue.default_value ?? field.default_value}
                  onChange={(e) =>
                    handleFieldChange(
                      field.args_id,
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
  );
}
