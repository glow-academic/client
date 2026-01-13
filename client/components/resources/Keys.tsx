/**
 * Keys.tsx
 * Resource component for key picker fields
 * Single-select resource component following Colors.tsx pattern
 */

"use client";

import { GenericPicker } from "@/components/common/forms/GenericPicker";
import { Label } from "@/components/ui/label";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { Check } from "lucide-react";
import { useCallback, useMemo } from "react";

type CreateDraftKeysIn = InputOf<"/api/v4/resources/keys", "post">;
type CreateDraftKeysOut = OutputOf<"/api/v4/resources/keys", "post">;

export interface KeyItem {
  id: string;
  name: string;
  description?: string;
  key_masked?: string;
  active?: boolean;
}

export interface KeysProps {
  key_id?: string | null; // Current key_id (standardized prop name)
  key_resource?: {
    id: string | null;
    name: string | null;
    description: string | null;
    key_masked: string | null;
    active: boolean | null;
    department_ids?: string[] | null;
    generated?: boolean | null;
  } | null; // Resource data from server (standardized prop name; includes generated field)
  show_key?: boolean; // Whether to show this resource picker
  key_suggestions?: string[]; // Array of suggested resource IDs (UUIDs)
  keys?: Array<{
    id: string | null;
    name: string | null;
    description: string | null;
    key_masked: string | null;
    active: boolean | null;
    department_ids?: string[] | null;
    generated?: boolean | null;
  }>; // All available keys from API (each includes generated field)
  disabled?: boolean; // Based on can_edit flag
  onKeyIdChange: (keyId: string | null) => void; // Update key_id in parent form state
  label?: string;
  id?: string;
  required?: boolean;
  placeholder?: string;
  group_id?: string | null; // Group ID for linking resources
  agent_id?: string | null; // Agent ID for resource creation
  createKeysAction?:
    | ((input: CreateDraftKeysIn) => Promise<CreateDraftKeysOut>)
    | undefined;
}

export function Keys({
  key_id,
  key_resource,
  show_key = false,
  key_suggestions,
  keys,
  disabled = false,
  onKeyIdChange,
  label = "Key",
  id = "key",
  required = false,
  placeholder = "Select a key...",
  group_id,
  agent_id,
  createKeysAction,
}: KeysProps) {
  const resource = key_resource ?? null;
  const resourceId = key_id ?? null;
  const show = show_key ?? false;
  const suggestionsList = useMemo(
    () => key_suggestions ?? [],
    [key_suggestions]
  );

  // Convert keys array from API format to KeyItem format
  const keyItems = useMemo(() => {
    return (keys ?? [])
      .filter((k) => k.id && k.name) // Filter out nulls
      .map((k) => ({
        id: k.id!,
        name: k.name!,
        ...(k.description ? { description: k.description } : {}),
        ...(k.key_masked ? { key_masked: k.key_masked } : {}),
        ...(k.active !== null ? { active: k.active } : {}),
      }));
  }, [keys]);

  // Check if a key is suggested
  const isSuggested = useCallback(
    (keyId: string) => suggestionsList.includes(keyId),
    [suggestionsList]
  );

  // Don't render if show_key is false (AFTER all hooks)
  if (!show) {
    return null;
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="flex items-center gap-1">
        {label}
        {required && <span className="text-destructive">*</span>}
      </Label>

      <GenericPicker<KeyItem>
        items={keyItems}
        selectedIds={resourceId ? [resourceId] : []}
        onSelect={(selectedIds) => {
          onKeyIdChange(selectedIds.length > 0 ? selectedIds[0] : null);
        }}
        multiSelect={false}
        getId={(item) => item.id}
        getLabel={(item) => item.name}
        renderItem={(item, isSelected) => (
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {isSuggested(item.id) && !isSelected && (
                <span className="px-1.5 py-0.5 bg-primary/10 text-primary text-xs rounded shrink-0">
                  Suggested
                </span>
              )}
              <div className="flex-1 min-w-0">
                <div className="truncate">{item.name}</div>
                {item.description && (
                  <div className="text-xs text-muted-foreground truncate">
                    {item.description}
                  </div>
                )}
                {item.key_masked && (
                  <div className="text-xs text-muted-foreground truncate font-mono">
                    {item.key_masked}
                  </div>
                )}
              </div>
            </div>
            <Check
              className={`ml-auto flex-shrink-0 h-4 w-4 ${
                isSelected ? "opacity-100" : "opacity-0"
              }`}
            />
          </div>
        )}
        emptyMessage="No keys available."
        disabled={disabled}
        placeholder={placeholder}
        showLabel={false}
      />
    </div>
  );
}
