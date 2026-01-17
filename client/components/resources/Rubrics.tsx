/**
 * Rubrics.tsx
 * Resource component for rubrics selection
 * Uses GenericPicker to select existing rubrics artifacts
 * Manages rubric_ids array and reports to parent
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

type CreateDraftRubricsIn = InputOf<"/api/v4/resources/rubrics", "post">;
type CreateDraftRubricsOut = OutputOf<"/api/v4/resources/rubrics", "post">;

export interface RubricsItem {
  id: string;
  name: string;
  description?: string;
}

export interface RubricsProps {
  rubric_ids?: string[]; // Current rubrics artifact IDs (standardized prop name)
  rubric_resources?: Array<{
    rubric_id: string | null;
    name: string | null;
    description?: string | null;
    generated?: boolean | null;
  }>; // Selected rubrics resources (each includes generated field)
  show_rubrics?: boolean; // Whether to show this resource picker
  rubric_suggestions?: string[]; // Array of suggested resource IDs (UUIDs)
  rubrics?: Array<{
    rubric_id: string | null;
    name: string | null;
    description?: string | null;
    generated?: boolean | null;
  }>; // All available rubrics from API (each includes generated field)
  disabled?: boolean; // Based on can_edit flag
  onChange: (ids: string[]) => void; // Update rubric_ids in form state
  label?: string;
  id?: string;
  required?: boolean;
  placeholder?: string;
  description?: string;
  group_id?: string | null; // Group ID for linking resources
  agent_id?: string | null; // Agent ID for resource creation
  createRubricsAction?:
    | ((input: CreateDraftRubricsIn) => Promise<CreateDraftRubricsOut>)
    | undefined;
  onGenerate?: () => void | Promise<void>;
  isGenerating?: boolean;
}

export function Rubrics({
  rubric_ids,
  rubric_resources,
  show_rubrics = false,
  rubric_suggestions,
  rubrics,
  disabled = false,
  onChange,
  label = "Rubrics",
  id = "rubrics",
  required = false,
  placeholder = "Select rubrics...",
  description,
  group_id,
  agent_id,
  createRubricsAction,
  onGenerate,
  isGenerating = false,
}: RubricsProps) {
  const ids = useMemo(() => rubric_ids ?? [], [rubric_ids]);
  const show = show_rubrics ?? false;
  const allRubrics = useMemo(() => rubrics ?? [], [rubrics]);
  const suggestionsList = useMemo(
    () => rubric_suggestions ?? [],
    [rubric_suggestions]
  );

  // Track which rubrics IDs have already had resources created
  const createdRubricsIdsRef = useRef<Set<string>>(new Set());

  // Initialize createdRubricsIdsRef with current IDs
  useEffect(() => {
    ids.forEach((id) => createdRubricsIdsRef.current.add(id));
  }, [ids]);

  // Convert rubrics array to RubricsItem format for GenericPicker
  const rubricsItems = useMemo(() => {
    return allRubrics
      .filter((p) => p.rubric_id && p.name) // Filter out nulls
      .map((p) => ({
        id: p.rubric_id!,
        name: p.name!,
        ...(p.description ? { description: p.description } : {}),
      }));
  }, [allRubrics]);

  // Check if a rubrics is suggested
  const isSuggested = useCallback(
    (rubricsId: string) => suggestionsList.includes(rubricsId),
    [suggestionsList]
  );

  const handleSelect = useCallback(
    async (selectedIds: string[]) => {
      // Find newly selected IDs
      const newlySelected = selectedIds.filter(
        (id) => !ids.includes(id) && !createdRubricsIdsRef.current.has(id)
      );

      // Create resources for newly selected rubrics
      if (
        newlySelected.length > 0 &&
        createRubricsAction &&
        agent_id &&
        group_id
      ) {
        for (const rubricsId of newlySelected) {
          try {
            await createRubricsAction({
              body: {
                agent_id: agent_id,
                group_id: group_id,
                rubric_id: rubricsId,
                mcp: false,
              },
            });
            createdRubricsIdsRef.current.add(rubricsId);
          } catch (error) {
            // eslint-disable-next-line no-console
            console.error(
              `Failed to create rubrics resource for ${rubricsId}:`,
              error
            );
            // Don't block UI - still update selection
          }
        }
      }

      // Update parent state
      onChange(selectedIds);
    },
    [ids, onChange, createRubricsAction, agent_id, group_id]
  );

  // Check if any rubrics resource is generated (must be before early return)
  const hasGenerated = useMemo(() => {
    return rubric_resources?.some((p) => p.generated) ?? false;
  }, [rubric_resources]);

  // Don't render if show_rubrics is false (AFTER all hooks)
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
      <GenericPicker<RubricsItem>
        items={rubricsItems}
        itemIds={allRubrics
          .map((p) => p.rubric_id)
          .filter((id): id is string => id !== null)} // All rubrics IDs from array, filter nulls
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
