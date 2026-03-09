/**
 * Operations.tsx
 * Resource component for operation type selection
 * Uses GenericPicker to select existing operation resources
 */

"use client";

import { GenericPicker } from "@/components/common/forms/GenericPicker";
import { Label } from "@/components/ui/label";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCallback, useMemo } from "react";

export interface OperationResourceItem {
  id?: string | null;
  operation?: string | null;
  generated?: boolean | null;
}

export interface OperationsProps {
  operation_ids?: string[];
  operation_resources?: OperationResourceItem[];
  show_operations?: boolean;
  operation_suggestions?: string[];
  operations?: OperationResourceItem[];
  disabled?: boolean;
  onChange: (ids: string[]) => void;
  label?: string;
  id?: string;
  required?: boolean;
  placeholder?: string;
  description?: string;
  searchTerm?: string;
  onSearchChange?: (term: string) => void;
}

interface OperationsItem {
  id: string;
  name: string;
}

export function Operations({
  operation_ids,
  show_operations = false,
  operations,
  disabled = false,
  onChange,
  label = "Operations",
  id = "operations",
  required = false,
  placeholder = "Select operations...",
  description,
  searchTerm,
  onSearchChange,
}: OperationsProps) {
  const ids = useMemo(() => operation_ids ?? [], [operation_ids]);
  const allOperations = useMemo(() => operations ?? [], [operations]);

  const filteredOperations = useMemo(() => {
    if (!searchTerm?.trim()) {
      return allOperations;
    }
    const term = searchTerm.toLowerCase();
    return allOperations.filter((op) => {
      const opName = op.operation?.toLowerCase() ?? "";
      return opName.includes(term);
    });
  }, [allOperations, searchTerm]);

  const operationsItems = useMemo(() => {
    return filteredOperations
      .filter((op) => op.id && op.operation)
      .map((op) => ({
        id: op.id!,
        name: op.operation!,
      }));
  }, [filteredOperations]);

  const handleSelect = useCallback(
    (selectedIds: string[]) => {
      onChange(selectedIds);
    },
    [onChange]
  );

  if (!show_operations) {
    return null;
  }

  return (
    <div className="space-y-2">
      {label && (
        <Label htmlFor={id} className="flex items-center gap-1">
          {label}
          {required && <span className="text-destructive">*</span>}
          {description && (
            <span className="text-xs text-muted-foreground ml-2">
              {description}
            </span>
          )}
        </Label>
      )}
      <GenericPicker<OperationsItem>
        items={operationsItems}
        itemIds={filteredOperations
          .map((op) => op.id)
          .filter((opId): opId is string => opId !== null)}
        selectedIds={ids}
        onSelect={handleSelect}
        multiSelect={true}
        getId={(item) => item.id}
        getLabel={(item) => item.name}
        renderItem={(item, isSelected) => (
          <div className="flex items-center justify-between w-full">
            <div className="flex-1 min-w-0">
              <div className="truncate">{item.name}</div>
            </div>
            <Check
              className={cn(
                "ml-auto flex-shrink-0 h-4 w-4",
                isSelected ? "opacity-100" : "opacity-0"
              )}
            />
          </div>
        )}
        {...(searchTerm !== undefined ? { initialSearchTerm: searchTerm } : {})}
        {...(onSearchChange ? { onSearchChange } : {})}
        placeholder={placeholder}
        disabled={disabled}
        showLabel={false}
        hideSelectedChips={false}
        showClearAll={true}
      />
    </div>
  );
}
