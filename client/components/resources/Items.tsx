/**
 * Items.tsx
 * Resource component for items selection
 * Uses GenericPicker to select existing items resources
 * Manages item_ids array and reports to parent
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

type CreateDraftItemsIn = InputOf<"/api/v4/resources/items", "post">;
type CreateDraftItemsOut = OutputOf<"/api/v4/resources/items", "post">;

export interface ItemsItem {
  id: string;
  name: string;
  description?: string;
}

export interface ItemsProps {
  item_ids?: string[]; // Current items resource IDs (standardized prop name)
  item_resources?: Array<{
    item_id: string | null;
    name: string | null;
    description?: string | null;
    generated?: boolean | null;
  }>; // Selected items resources (each includes generated field)
  show_items?: boolean; // Whether to show this resource picker
  item_suggestions?: string[]; // Array of suggested resource IDs (UUIDs)
  items?: Array<{
    item_id: string | null;
    name: string | null;
    description?: string | null;
    generated?: boolean | null;
  }>; // All available items from API (each includes generated field)
  disabled?: boolean; // Based on can_edit flag
  onChange: (ids: string[]) => void; // Update item_ids in form state
  label?: string;
  id?: string;
  required?: boolean;
  placeholder?: string;
  description?: string;
  group_id?: string | null; // Group ID for linking resources
  create_tool_id?: string | null; // Tool ID for AI generation/creation
  link_tool_id?: string | null; // Tool ID for AI link suggestions
  createItemsAction?:
    | ((input: CreateDraftItemsIn) => Promise<CreateDraftItemsOut>)
    | undefined;
  onGenerate?: () => void | Promise<void>;
  isGenerating?: boolean;
  // AI diff view props
  aiItemResources?: Array<{ id?: string | null; name?: string | null }> | null;
  onAccept?: () => void;
  onReject?: () => void;
}

export function Items({
  item_ids,
  item_resources,
  show_items = false,
  item_suggestions,
  items,
  disabled = false,
  onChange,
  label = "Items",
  id = "items",
  required = false,
  placeholder = "Select items...",
  description,
  group_id,
  create_tool_id,
  link_tool_id,
  createItemsAction,
  onGenerate,
  isGenerating = false,
  // AI diff view props
  aiItemResources,
  onAccept,
  onReject,
}: ItemsProps) {
  const ids = useMemo(() => item_ids ?? [], [item_ids]);
  const show = show_items ?? false;
  const allItems = useMemo(() => items ?? [], [items]);
  const suggestionsList = useMemo(
    () => item_suggestions ?? [],
    [item_suggestions]
  );

  // Track which items IDs have already had resources created
  const createdItemsIdsRef = useRef<Set<string>>(new Set());

  // Initialize createdItemsIdsRef with current IDs
  useEffect(() => {
    ids.forEach((id) => createdItemsIdsRef.current.add(id));
  }, [ids]);

  // Convert items array to ItemsItem format for GenericPicker
  const itemsItems = useMemo(() => {
    return allItems
      .filter((m) => m.item_id && m.name) // Filter out nulls
      .map((m) => ({
        id: m.item_id!,
        name: m.name!,
        ...(m.description ? { description: m.description } : {}),
      }));
  }, [allItems]);

  // Check if a items is suggested
  const isSuggested = useCallback(
    (itemsId: string) => suggestionsList.includes(itemsId),
    [suggestionsList]
  );

  const handleSelect = useCallback(
    async (selectedIds: string[]) => {
      // Items are generated, not selected from existing artifacts
      // Update parent state
      onChange(selectedIds);
    },
    [onChange]
  );

  // Check if any items resource is generated (must be before early return)
  const hasGenerated = useMemo(() => {
    return item_resources?.some((m) => m.generated) ?? false;
  }, [item_resources]);

  // AI suggestion state
  const showDiff = !!aiItemResources?.length;

  // Get AI-suggested IDs (kept for potential future use)
  const _aiSuggestedIds = useMemo(
    () => new Set(aiItemResources?.map((r) => r.id).filter(Boolean) as string[]),
    [aiItemResources]
  );

  // Accept AI suggestion - add AI-suggested items to selection
  const handleAccept = useCallback(() => {
    if (!aiItemResources?.length) return;
    const newIds = aiItemResources
      .map((i) => i.id)
      .filter((id): id is string => !!id);
    if (newIds.length > 0) {
      onChange([...ids, ...newIds]);
    }
    onAccept?.();
  }, [aiItemResources, ids, onChange, onAccept]);

  // Reject AI suggestion - just clear the pending state
  const handleReject = useCallback(() => {
    onReject?.();
  }, [onReject]);

  // Don't render if show_items is false (AFTER all hooks)
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
          {onGenerate && create_tool_id && (
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
      {/* AI-suggested items preview */}
      {showDiff && aiItemResources && aiItemResources.length > 0 && (
        <div className="mb-4 space-y-2">
          <p className="text-sm font-medium text-success">AI Suggested Items</p>
          <div className="space-y-2">
            {aiItemResources.map((item, idx) => (
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
      <GenericPicker<ItemsItem>
        items={itemsItems}
        itemIds={allItems
          .map((m) => m.item_id)
          .filter((id): id is string => id !== null)} // All items IDs from array, filter nulls
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
