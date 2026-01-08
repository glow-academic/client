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
  fieldIds: string[]; // Current field resource IDs from form state
  onChange: (ids: string[]) => void; // Update field_ids in form state
  fields: Array<{ field_id: string; name: string; description?: string }>; // Array from SQL (database already filtered)
  label?: string;
  disabled?: boolean;
  id?: string;
  placeholder?: string;
  description?: string;
}

export function Fields({
  fieldIds,
  onChange,
  fields, // Direct array from SQL, no mapping needed
  label = "Fields",
  disabled = false,
  id = "fields",
  placeholder = "Select fields...",
  description,
}: FieldsProps) {
  // Convert fields array to FieldItem format for GenericPicker
  const fieldItems = useMemo(() => {
    return fields.map((f) => ({
      id: f.field_id,
      name: f.name,
      description: f.description,
    }));
  }, [fields]);

  const handleSelect = useCallback(
    (ids: string[]) => {
      onChange(ids);
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
