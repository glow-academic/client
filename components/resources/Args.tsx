/**
 * Args.tsx
 * Component for editing argument fields
 * Pure UI: receives data arrays + selected IDs, reports changes via onChange
 */

"use client";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Check, X } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export interface ArgsResourceItem {
  id?: string | null;
  name?: string | null;
  pending?: boolean | null;
}

export interface ArgsFieldDetail {
  args_id: string;
  name: string;
  description: string;
  field_type: string;
  required: boolean;
  default_value: string;
  generated: boolean;
  pending?: boolean | null;
}

export interface ArgsProps {
  args_ids: string[]; // From Tool.tsx formState - which args are selected
  input_args_fields: ArgsFieldDetail[]; // From API - detailed field data for selected args_ids
  disabled: boolean; // Based on can_edit flag from Tool.tsx
  /** Callback to update args_ids selection (used for reject pending) */
  onChange?: (ids: string[]) => void;
  /** Hide the "Args Fields" header label — orchestrator owns it. */
  hideHeader?: boolean;
}

export function Args({
  args_ids,
  input_args_fields,
  disabled = false,
  onChange,
  hideHeader = false,
}: ArgsProps) {
  const sortedFields = useMemo(() => {
    return [...input_args_fields].sort((a, b) => a.name.localeCompare(b.name));
  }, [input_args_fields]);

  // Internal state for field values
  const [fieldValues, setFieldValues] = useState<
    Record<string, Partial<ArgsFieldDetail>>
  >({});
  const lastSavedValuesRef = useRef<Record<string, Partial<ArgsFieldDetail>>>(
    {}
  );
  const isInitialMountRef = useRef(true);
  // Dirty flag: once the user edits a field, stop syncing from server so
  // in-progress field edits aren't clobbered (same pattern as Descriptions.tsx).
  const isDirtyRef = useRef(false);

  // Pending state: items with pending=true from soft draft connections
  const pendingItems = useMemo(() => {
    return input_args_fields.filter((f) => f.pending && f.args_id);
  }, [input_args_fields]);
  const showDiff = pendingItems.length > 0;
  const pendingIds = useMemo(
    () => new Set(pendingItems.map((f) => f.args_id).filter(Boolean)),
    [pendingItems]
  );

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
        };
      });
      setFieldValues(initialValues);
      lastSavedValuesRef.current = initialValues;
      isInitialMountRef.current = false;
    }
  }, [input_args_fields]);

  // Sync field values when props change. Skip while the user is editing so
  // in-progress text isn't clobbered.
  useEffect(() => {
    if (isDirtyRef.current) return;
    const newValues: Record<string, Partial<ArgsFieldDetail>> = {};
    let hasChanges = false;
    input_args_fields.forEach((field) => {
      const currentValue = lastSavedValuesRef.current[field.args_id];
      if (
        !currentValue ||
        currentValue.name !== field.name ||
        currentValue.field_type !== field.field_type ||
        currentValue.required !== field.required ||
        currentValue.description !== field.description ||
        currentValue.default_value !== field.default_value
      ) {
        newValues[field.args_id] = {
          name: field.name,
          field_type: field.field_type,
          required: field.required,
          description: field.description,
          default_value: field.default_value,
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

  // Handle field value change
  const handleFieldChange = useCallback(
    (
      fieldId: string,
      key: keyof ArgsFieldDetail,
      value: string | number | boolean
    ) => {
      isDirtyRef.current = true;
      setFieldValues((prev) => ({
        ...prev,
        [fieldId]: {
          ...prev[fieldId],
          [key]: value,
        },
      }));
    },
    []
  );

  // Accept pending — pending items are already in selection, no-op
  const handleAccept = useCallback(() => {
    // Pending items are already in args_ids (selected=true), just confirm
    // The next draft save will persist them as active
    // Nothing to change in form state — they're already included
  }, []);

  // Reject pending — remove pending args from selection
  const handleReject = useCallback(() => {
    if (onChange) {
      const newIds = args_ids.filter((id) => !pendingIds.has(id));
      onChange(newIds);
    }
  }, [args_ids, pendingIds, onChange]);

  // Don't render if no args selected
  if (args_ids.length === 0) {
    return (
      <div className="text-sm text-muted-foreground p-4">
        No args selected. Select args in the &quot;Args&quot; step to edit their fields.
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
      {/* Header with pending diff controls */}
      {showDiff && !hideHeader && (
        <div className="flex items-center gap-2">
          <Label className="flex items-center gap-1">Args Fields</Label>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-success hover:text-success"
                  onClick={handleAccept}
                >
                  <Check className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Accept</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-destructive hover:text-destructive"
                  onClick={handleReject}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Reject</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      )}

      {/* Fields */}
      {sortedFields.map((field) => {
        const fieldValue = fieldValues[field.args_id] ?? {};
        const isPending = pendingIds.has(field.args_id);

        return (
          <div
            key={field.args_id}
            className={cn(
              "border rounded-md p-4 space-y-4",
              isPending && "ring-2 ring-success bg-success/10",
            )}
          >
            {/* Pending badge */}
            {isPending && (
              <div className="flex justify-end">
                <span className="px-1.5 py-0.5 bg-success/20 text-success text-[10px] rounded font-medium">
                  Pending
                </span>
              </div>
            )}

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
        );
      })}
    </div>
  );
}
