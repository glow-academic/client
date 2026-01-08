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
  validFieldIds: string[]; // Valid field IDs user can select
  fieldMapping: Record<string, FieldItem>; // Mapping of field_id -> {id, name, description}
  label?: string;
  disabled?: boolean;
  id?: string;
  placeholder?: string;
  description?: string;
}

export function Fields({
  fieldIds,
  onChange,
  validFieldIds,
  fieldMapping,
  label = "Fields",
  disabled = false,
  id = "fields",
  placeholder = "Select fields...",
  description,
}: FieldsProps) {
  // Convert fieldMapping to array format for GenericPicker
  const fieldItems = useMemo(() => {
    return Object.values(fieldMapping).filter((field) =>
      validFieldIds.includes(field.id)
    );
  }, [fieldMapping, validFieldIds]);

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
        itemIds={validFieldIds}
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
