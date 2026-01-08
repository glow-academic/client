/**
 * Fields.tsx
 * Resource component for field selection
 * Uses GenericPicker to select existing field resources
 * Manages field_ids array and reports to parent
 */

"use client";

import { GenericPicker } from "@/components/common/forms/GenericPicker";
import { Label } from "@/components/ui/label";
import { useCallback, useMemo } from "react";

export interface FieldItem {
  id: string;
  name: string;
  description?: string;
}

export interface FieldsProps {
  field_ids?: string[]; // Current field resource IDs (standardized prop name)
  field_resources?: Array<{ field_id: string | null; name: string | null; description?: string | null }>; // Selected field resources
  show_fields?: boolean; // Whether to show this resource picker
  field_suggestions?: string[]; // Array of suggested resource IDs (UUIDs)
  fields?: Array<{ field_id: string | null; name: string | null; description?: string | null }>; // All available fields from API
  disabled?: boolean; // Based on can_edit flag
  onChange: (ids: string[]) => void; // Update field_ids in form state
  label?: string;
  id?: string;
  placeholder?: string;
  description?: string;
  // Legacy props for backward compatibility
  fieldIds?: string[];
}

export function Fields({
  field_ids,
  field_resources,
  show_fields = false,
  field_suggestions,
  fields,
  disabled = false,
  onChange,
  label = "Fields",
  id = "fields",
  placeholder = "Select fields...",
  description,
  // Legacy props for backward compatibility
  fieldIds,
}: FieldsProps) {
  // Use standardized props with fallback to legacy props
  const ids = field_ids ?? fieldIds ?? [];
  const show = show_fields ?? false;
  const allFields = fields ?? [];

  // Don't render if show_fields is false
  if (!show) {
    return null;
  }

  // Convert fields array to FieldItem format for GenericPicker
  const fieldItems = useMemo(() => {
    return allFields
      .filter((f) => f.field_id && f.name) // Filter out nulls
      .map((f) => ({
        id: f.field_id!,
        name: f.name!,
        description: f.description ?? undefined,
      }));
  }, [allFields]);

  const handleSelect = useCallback(
    (selectedIds: string[]) => {
      onChange(selectedIds);
    },
    [onChange]
  );

  return (
    <div className="space-y-2">
      {label && (
        <Label htmlFor={id}>
          {label}
          {description && (
            <span className="text-xs text-muted-foreground ml-2">
              {description}
            </span>
          )}
        </Label>
      )}
      <GenericPicker<FieldItem>
        items={fieldItems}
        itemIds={fields.map((f) => f.field_id)} // All field IDs from array
        selectedIds={fieldIds}
        onSelect={handleSelect}
        multiSelect={true}
        getId={(item) => item.id}
        getLabel={(item) => item.name}
        getSearchText={(item) =>
          `${item.name} ${item.description || ""}`.trim()
        }
        placeholder={placeholder}
        disabled={disabled}
        showLabel={false}
        hideSelectedChips={false}
        showClearAll={true}
      />
    </div>
  );
}
