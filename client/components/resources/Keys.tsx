/**
 * Keys.tsx
 * Resource component for key picker fields
 * Single-select resource component following Colors.tsx pattern
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
import { Check, Loader2, Sparkles, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef } from "react";

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
  onKeyIdChange?: (keyId: string | null) => void; // Update key_id in parent form state (single-select)
  key_ids?: string[]; // Current key resource IDs (multi-select)
  key_resources?: Array<{
    key_id: string | null;
    name: string | null;
    masked_key: string | null;
    description: string | null;
    active: boolean | null;
    department_ids?: string[] | null;
    generated?: boolean | null;
  }>; // Selected key resources (multi-select)
  onChange?: (ids: string[]) => void; // Update key_ids in parent form state (multi-select)
  multiSelect?: boolean; // Whether to use multi-select mode
  onGenerate?: () => void | Promise<void>;
  isGenerating?: boolean;
  label?: string;
  id?: string;
  required?: boolean;
  placeholder?: string;
  group_id?: string | null; // Group ID for linking resources
  create_tool_id?: string | null; // Tool ID for AI generation/creation
  link_tool_id?: string | null; // Tool ID for AI link suggestions
  createKeysAction?:
    | ((input: CreateDraftKeysIn) => Promise<CreateDraftKeysOut>)
    | undefined;
  // AI diff view props
  aiKeyResources?: Array<{ id?: string | null; name?: string | null }> | null;
  onAccept?: () => void;
  onReject?: () => void;
}

export function Keys({
  key_id,
  key_resource,
  show_key = false,
  key_suggestions,
  keys,
  disabled = false,
  onKeyIdChange,
  key_ids,
  key_resources,
  onChange,
  multiSelect = false,
  onGenerate,
  isGenerating = false,
  label = "Key",
  id = "key",
  required = false,
  placeholder = "Select a key...",
  group_id,
  create_tool_id,
  link_tool_id,
  createKeysAction,
  // AI diff view props
  aiKeyResources,
  onAccept,
  onReject,
}: KeysProps) {
  const resource = key_resource ?? null;
  const resourceId = key_id ?? null;
  const show = show_key ?? false;
  const suggestionsList = useMemo(
    () => key_suggestions ?? [],
    [key_suggestions]
  );
  const ids = useMemo(() => key_ids ?? [], [key_ids]);
  
  // Track which key IDs have already had resources created (multi-select)
  const createdKeyIdsRef = useRef<Set<string>>(new Set());
  
  // Initialize createdKeyIdsRef with current IDs
  useEffect(() => {
    ids.forEach((id) => createdKeyIdsRef.current.add(id));
  }, [ids]);
  
  // Check if any key resource is generated (multi-select)
  const hasGenerated = useMemo(() => {
    return key_resources?.some((k) => k.generated) ?? false;
  }, [key_resources]);

  // Convert keys array from API format to KeyItem format
  const keyItems = useMemo(() => {
    if (multiSelect) {
      // Multi-select: use key_id field
      return (keys ?? [])
        .filter((k) => k.key_id && k.name) // Filter out nulls
        .map((k) => ({
          id: k.key_id!,
          name: k.name!,
          ...(k.description ? { description: k.description } : {}),
          ...(k.masked_key ? { key_masked: k.masked_key } : {}),
          ...(k.active !== null ? { active: k.active } : {}),
        }));
    }
    // Single-select: use id field
    return (keys ?? [])
      .filter((k) => k.id && k.name) // Filter out nulls
      .map((k) => ({
        id: k.id!,
        name: k.name!,
        ...(k.description ? { description: k.description } : {}),
        ...(k.key_masked ? { key_masked: k.key_masked } : {}),
        ...(k.active !== null ? { active: k.active } : {}),
      }));
  }, [keys, multiSelect]);

  // Check if a key is suggested
  const isSuggested = useCallback(
    (keyId: string) => suggestionsList.includes(keyId),
    [suggestionsList]
  );

  const handleSelectMulti = useCallback(
    async (selectedIds: string[]) => {
      // Find newly selected IDs
      const newlySelected = selectedIds.filter(
        (id) => !ids.includes(id) && !createdKeyIdsRef.current.has(id)
      );

      // Create resources for newly selected keys
      if (
        newlySelected.length > 0 &&
        createKeysAction &&
        create_tool_id &&
        group_id
      ) {
        for (const keyId of newlySelected) {
          try {
            await createKeysAction({
              body: {
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
      if (onChange) {
        onChange(selectedIds);
      }
    },
    [ids, onChange, createKeysAction, create_tool_id, group_id]
  );

  // AI suggestion state
  const showDiff = !!aiKeyResources?.length;

  // Accept AI suggestion - add AI-suggested keys to selection
  const handleAccept = useCallback(async () => {
    if (!aiKeyResources?.length) return;
    const aiIds = aiKeyResources
      .map((r) => r.id)
      .filter((id): id is string => !!id);
    if (multiSelect && onChange) {
      // Add AI-suggested IDs to existing selection
      const newIds = [...ids, ...aiIds.filter((id) => !ids.includes(id))];
      onChange(newIds);
    } else if (onKeyIdChange && aiIds.length > 0) {
      // Single-select: use first AI-suggested key
      onKeyIdChange(aiIds[0]);
    }
    onAccept?.();
  }, [aiKeyResources, multiSelect, onChange, onKeyIdChange, ids, onAccept]);

  // Reject AI suggestion - just clear the pending state
  const handleReject = useCallback(() => {
    onReject?.();
  }, [onReject]);

  // Don't render if show_key is false (AFTER all hooks)
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
          </Label>
          {onGenerate && create_tool_id && multiSelect && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={onGenerate}
                    disabled={disabled || isGenerating || showDiff}
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
          {showDiff && (
            <>
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
            </>
          )}
        </div>
      )}

      {/* AI-suggested keys preview */}
      {showDiff && aiKeyResources && aiKeyResources.length > 0 && (
        <div className="mb-4 space-y-2">
          <p className="text-sm font-medium text-success">AI Suggested Keys</p>
          <div className="space-y-2">
            {aiKeyResources.map((item, idx) => (
              <div
                key={item.id || idx}
                className={cn(
                  "p-3 rounded-lg border-2 border-success bg-success/10",
                  "text-sm"
                )}
              >
                {item.name || ""}
              </div>
            ))}
          </div>
        </div>
      )}

      <GenericPicker<KeyItem>
        items={keyItems}
        itemIds={multiSelect 
          ? (keys?.map((k) => k.key_id).filter((id): id is string => id !== null) ?? [])
          : (keys?.map((k) => k.id).filter((id): id is string => id !== null) ?? [])}
        selectedIds={multiSelect ? ids : (resourceId ? [resourceId] : [])}
        onSelect={multiSelect 
          ? handleSelectMulti
          : (selectedIds) => {
              if (onKeyIdChange) {
                onKeyIdChange(selectedIds.length > 0 ? selectedIds[0] : null);
              }
            }}
        multiSelect={multiSelect}
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
              className={cn(
                "ml-auto flex-shrink-0 h-4 w-4",
                isSelected ? "opacity-100" : "opacity-0"
              )}
            />
          </div>
        )}
        emptyMessage="No keys available."
        disabled={disabled}
        placeholder={placeholder}
        showLabel={false}
        hideSelectedChips={multiSelect ? false : true}
        showClearAll={multiSelect ? true : false}
      />
    </div>
  );
}
