/**
 * SettingKeys.tsx
 * Multi-select resource component for keys in settings
 * Follows Departments.tsx pattern for multi-select resources
 */

"use client";

import { GenericPicker } from "@/components/common/forms/GenericPicker";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { Check, Loader2, Sparkles } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef } from "react";

type CreateDraftKeysIn = InputOf<"/api/v4/resources/keys", "post">;
type CreateDraftKeysOut = OutputOf<"/api/v4/resources/keys", "post">;

export interface SettingKeyItem {
  id: string;
  name: string;
  description?: string;
  masked_key?: string;
  active?: boolean;
}

export interface SettingKeysProps {
  key_ids?: string[]; // Current key resource IDs (standardized prop name)
  key_resources?: Array<{
    key_id: string | null;
    name: string | null;
    masked_key: string | null;
    description: string | null;
    active: boolean | null;
    department_ids?: string[] | null;
    generated?: boolean | null;
  }>; // Selected key resources (each includes generated field)
  show_keys?: boolean; // Whether to show this resource picker
  key_suggestions?: string[]; // Array of suggested resource IDs (UUIDs)
  keys?: Array<{
    key_id: string | null;
    name: string | null;
    masked_key: string | null;
    description: string | null;
    active: boolean | null;
    department_ids?: string[] | null;
    generated?: boolean | null;
  }>; // All available keys from API (each includes generated field)
  disabled?: boolean; // Based on can_edit flag
  onChange: (ids: string[]) => void; // Update key_ids in form state
  label?: string;
  id?: string;
  required?: boolean;
  placeholder?: string;
  description?: string;
  group_id?: string | null; // Group ID for linking resources
  agent_id?: string | null; // Agent ID for resource creation
  createKeysAction?:
    | ((input: CreateDraftKeysIn) => Promise<CreateDraftKeysOut>)
    | undefined;
  onGenerate?: () => void | Promise<void>;
  isGenerating?: boolean;
}

export function SettingKeys({
  key_ids,
  key_resources,
  show_keys = false,
  key_suggestions,
  keys,
  disabled = false,
  onChange,
  label = "Keys",
  id = "keys",
  required = false,
  placeholder = "Select keys...",
  description,
  group_id,
  agent_id,
  createKeysAction,
  onGenerate,
  isGenerating = false,
}: SettingKeysProps) {
  const ids = useMemo(() => key_ids ?? [], [key_ids]);
  const show = show_keys ?? false;
  const allKeys = useMemo(() => keys ?? [], [keys]);
  const suggestionsList = useMemo(
    () => key_suggestions ?? [],
    [key_suggestions]
  );

  // Track which key IDs have already had resources created
  const createdKeyIdsRef = useRef<Set<string>>(new Set());

  // Initialize createdKeyIdsRef with current IDs
  useEffect(() => {
    ids.forEach((id) => createdKeyIdsRef.current.add(id));
  }, [ids]);

  // Convert keys array to SettingKeyItem format for GenericPicker
  const keyItems = useMemo(() => {
    return allKeys
      .filter((k) => k.key_id && k.name) // Filter out nulls
      .map((k) => ({
        id: k.key_id!,
        name: k.name!,
        ...(k.description ? { description: k.description } : {}),
        ...(k.masked_key ? { masked_key: k.masked_key } : {}),
        ...(k.active !== null ? { active: k.active } : {}),
      }));
  }, [allKeys]);

  // Check if a key is suggested
  const isSuggested = useCallback(
    (keyId: string) => suggestionsList.includes(keyId),
    [suggestionsList]
  );

  const handleSelect = useCallback(
    async (selectedIds: string[]) => {
      // Find newly selected IDs
      const newlySelected = selectedIds.filter(
        (id) => !ids.includes(id) && !createdKeyIdsRef.current.has(id)
      );

      // Create resources for newly selected keys
      if (
        newlySelected.length > 0 &&
        createKeysAction &&
        agent_id &&
        group_id
      ) {
        for (const keyId of newlySelected) {
          try {
            await createKeysAction({
              body: {
                agent_id: agent_id,
                group_id: group_id,
                key_id: keyId,
                mcp: false,
              },
            });
            createdKeyIdsRef.current.add(keyId);
          } catch (error) {
            // eslint-disable-next-line no-console
            console.error(`Failed to create key resource for ${keyId}:`, error);
            // Don't block UI - still update selection
          }
        }
      }

      // Update parent state
      onChange(selectedIds);
    },
    [ids, onChange, createKeysAction, agent_id, group_id]
  );

  // Check if any key resource is generated (must be before early return)
  const hasGenerated = useMemo(() => {
    return key_resources?.some((k) => k.generated) ?? false;
  }, [key_resources]);

  // Don't render if show_keys is false (AFTER all hooks)
  if (!show) {
    return null;
  }

  return (
    <div className="space-y-2">
      {label && (
        <div className="flex items-center gap-2">
          <Label htmlFor={id} className="flex items-center gap-1">
            {label}
            {required && <span className="text-destructive">*</span>}
            {description && (
              <span className="text-xs text-muted-foreground ml-2">
                {description}
              </span>
            )}
          </Label>
          {onGenerate && agent_id && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={onGenerate}
                    disabled={disabled || isGenerating}
                  >
                    {isGenerating ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {hasGenerated ? "Regenerate" : "Generate"}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      )}
      <GenericPicker<SettingKeyItem>
        items={keyItems}
        itemIds={allKeys
          .map((k) => k.key_id)
          .filter((id): id is string => id !== null)} // All key IDs from array, filter nulls
        selectedIds={ids}
        onSelect={handleSelect}
        multiSelect={true}
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
                {item.masked_key && (
                  <div className="text-xs text-muted-foreground truncate font-mono">
                    {item.masked_key}
                  </div>
                )}
              </div>
            </div>
            <Check
              className={cn(
                "ml-auto flex-shrink-0 h-4 w-4",
                isSelected ? "opacity-100" : "opacity-0"
              )}
            />
          </div>
        )}
        placeholder={placeholder}
        disabled={disabled}
        showLabel={false}
        hideSelectedChips={false}
        showClearAll={true}
      />
    </div>
  );
}
