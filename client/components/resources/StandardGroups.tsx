/**
 * StandardGroups.tsx
 * Resource component for standard group selection
 * Uses GenericPicker to select existing standard group resources
 * Manages standard_group_ids array and reports to parent
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

type CreateDraftStandardGroupsIn = InputOf<
  "/api/v4/resources/standard_groups",
  "post"
>;
type CreateDraftStandardGroupsOut = OutputOf<
  "/api/v4/resources/standard_groups",
  "post"
>;

export interface StandardGroupItem {
  id: string;
  name: string;
  description?: string;
  points?: number;
  pass_points?: number;
  position?: number;
  active?: boolean;
  standard_ids?: string[];
  generated?: boolean;
}

export interface StandardGroupsProps {
  standard_group_ids?: string[]; // Current standard group resource IDs (standardized prop name)
  standard_group_resources?: Array<{
    standard_group_id: string | null;
    name: string | null;
    description?: string | null;
    points?: number | null;
    pass_points?: number | null;
    position?: number | null;
    active?: boolean | null;
    standard_ids?: string[] | null;
    generated?: boolean | null;
  }>; // Selected standard group resources (each includes generated field)
  show_standard_groups?: boolean; // Whether to show this resource picker
  standard_group_suggestions?: string[]; // Array of suggested resource IDs (UUIDs)
  standard_groups?: Array<{
    standard_group_id: string | null;
    name: string | null;
    description?: string | null;
    points?: number | null;
    pass_points?: number | null;
    position?: number | null;
    active?: boolean | null;
    standard_ids?: string[] | null;
    generated?: boolean | null;
  }>; // All available standard groups from API (each includes generated field)
  disabled?: boolean; // Based on can_edit flag
  onChange: (ids: string[]) => void; // Update standard_group_ids in form state
  label?: string;
  id?: string;
  required?: boolean;
  placeholder?: string;
  description?: string;
  group_id?: string | null; // Group ID for linking resources
  agent_id?: string | null; // Agent ID for resource creation
  createStandardGroupsAction?:
    | ((
        input: CreateDraftStandardGroupsIn
      ) => Promise<CreateDraftStandardGroupsOut>)
    | undefined;
  onGenerate?: () => void | Promise<void>;
  isGenerating?: boolean;
  // Legacy props for backward compatibility
  standardGroupIds?: string[];
}

export function StandardGroups({
  standard_group_ids,
  standard_group_resources,
  show_standard_groups = false,
  standard_group_suggestions,
  standard_groups,
  disabled = false,
  onChange,
  label = "Standard Groups",
  id = "standard_groups",
  required = false,
  placeholder = "Select standard groups...",
  description,
  group_id,
  agent_id,
  createStandardGroupsAction,
  onGenerate,
  isGenerating = false,
  // Legacy props for backward compatibility
  standardGroupIds,
}: StandardGroupsProps) {
  // Use standardized props with fallback to legacy props
  const ids = useMemo(
    () => standard_group_ids ?? standardGroupIds ?? [],
    [standard_group_ids, standardGroupIds]
  );
  const show = show_standard_groups ?? false;
  const allStandardGroups = useMemo(
    () => standard_groups ?? [],
    [standard_groups]
  );
  const suggestionsList = useMemo(
    () => standard_group_suggestions ?? [],
    [standard_group_suggestions]
  );

  // Track which standard group IDs have already had resources created
  const createdStandardGroupIdsRef = useRef<Set<string>>(new Set());

  // Initialize createdStandardGroupIdsRef with current IDs
  useEffect(() => {
    ids.forEach((id) => createdStandardGroupIdsRef.current.add(id));
  }, [ids]);

  // Convert standard_groups array to StandardGroupItem format for GenericPicker
  const standardGroupItems = useMemo(() => {
    return allStandardGroups
      .filter((sg) => sg.standard_group_id && sg.name) // Filter out nulls
      .map((sg) => ({
        id: sg.standard_group_id!,
        name: sg.name!,
        ...(sg.description ? { description: sg.description } : {}), // Only include if not null/undefined
        ...(sg.points !== null && sg.points !== undefined
          ? { points: sg.points }
          : {}),
        ...(sg.pass_points !== null && sg.pass_points !== undefined
          ? { pass_points: sg.pass_points }
          : {}),
        ...(sg.position !== null && sg.position !== undefined
          ? { position: sg.position }
          : {}),
        ...(sg.active !== null && sg.active !== undefined
          ? { active: sg.active }
          : {}),
        ...(sg.standard_ids ? { standard_ids: sg.standard_ids } : {}),
        ...(sg.generated !== null && sg.generated !== undefined
          ? { generated: sg.generated }
          : {}),
      }));
  }, [allStandardGroups]);

  // Check if a standard group is suggested
  const isSuggested = useCallback(
    (standardGroupId: string) => suggestionsList.includes(standardGroupId),
    [suggestionsList]
  );

  const handleSelect = useCallback(
    async (selectedIds: string[]) => {
      // Find newly selected IDs
      const newlySelected = selectedIds.filter(
        (id) => !ids.includes(id) && !createdStandardGroupIdsRef.current.has(id)
      );

      // Create resources for newly selected standard groups
      if (
        newlySelected.length > 0 &&
        createStandardGroupsAction &&
        agent_id &&
        group_id
      ) {
        for (const standardGroupId of newlySelected) {
          try {
            // Find the standard group to get its details
            const standardGroup = allStandardGroups.find(
              (sg) => sg.standard_group_id === standardGroupId
            );

            if (standardGroup) {
              await createStandardGroupsAction({
                body: {
                  agent_id: agent_id,
                  group_id: group_id,
                  standard_group_id: standardGroupId,
                  mcp: false,
                },
              });
              createdStandardGroupIdsRef.current.add(standardGroupId);
            }
          } catch (error) {
            // eslint-disable-next-line no-console
            console.error(
              `Failed to create standard group resource for ${standardGroupId}:`,
              error
            );
            // Don't block UI - still update selection
          }
        }
      }

      // Update parent state
      onChange(selectedIds);
    },
    [
      ids,
      onChange,
      createStandardGroupsAction,
      agent_id,
      group_id,
      allStandardGroups,
    ]
  );

  // Check if any standard group resource is generated (must be before early return)
  const hasGenerated = useMemo(() => {
    return standard_group_resources?.some((sg) => sg.generated) ?? false;
  }, [standard_group_resources]);

  // Don't render if show_standard_groups is false (AFTER all hooks)
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
      <GenericPicker<StandardGroupItem>
        items={standardGroupItems}
        itemIds={allStandardGroups
          .map((sg) => sg.standard_group_id)
          .filter((id): id is string => id !== null)} // All standard group IDs from array, filter nulls
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
                {(item.points !== undefined ||
                  item.pass_points !== undefined) && (
                  <div className="text-xs text-muted-foreground">
                    {item.points !== undefined && `Points: ${item.points}`}
                    {item.pass_points !== undefined &&
                      ` | Pass: ${item.pass_points}`}
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
