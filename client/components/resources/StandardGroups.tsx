/**
 * StandardGroups.tsx
 * Resource component for standard group selection
 * Uses SelectableGrid to select existing standard group resources
 * Manages standard_group_ids array and reports to parent
 */

"use client";

import { SelectableGrid } from "@/components/common/forms/SelectableGrid";
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
  description?: string;
  searchTerm?: string;
  showSelectedFilter?: boolean;
  group_id?: string | null; // Group ID for linking resources
  create_tool_id?: string | null; // Tool ID for AI generation/creation
  link_tool_id?: string | null; // Tool ID for AI link suggestions
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
  description,
  searchTerm = "",
  showSelectedFilter = false,
  group_id,
  create_tool_id,
  link_tool_id,
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

  // Convert standard_groups array to StandardGroupItem format for SelectableGrid
  const standardGroupItems = useMemo(() => {
    return allStandardGroups
      .filter((sg) => sg.standard_group_id && sg.name) // Filter out nulls
      .map((sg) => ({
        id: sg.standard_group_id!,
        name: sg.name!,
        ...(sg.description ? { description: sg.description } : {}),
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
        create_tool_id &&
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
      create_tool_id,
      group_id,
      allStandardGroups,
    ]
  );

  const handleToggleSelect = useCallback(
    (standardGroupId: string) => {
      const isSelected = ids.includes(standardGroupId);
      const nextIds = isSelected
        ? ids.filter((id) => id !== standardGroupId)
        : [...ids, standardGroupId];
      handleSelect(nextIds);
    },
    [ids, handleSelect]
  );

  const filteredStandardGroups = useMemo(() => {
    if (!searchTerm.trim()) {
      return standardGroupItems;
    }
    const term = searchTerm.toLowerCase();
    return standardGroupItems.filter((group) => {
      const points = group.points !== undefined ? String(group.points) : "";
      const passPoints =
        group.pass_points !== undefined ? String(group.pass_points) : "";
      return (
        group.name.toLowerCase().includes(term) ||
        group.description?.toLowerCase().includes(term) ||
        points.toLowerCase().includes(term) ||
        passPoints.toLowerCase().includes(term)
      );
    });
  }, [standardGroupItems, searchTerm]);

  const displayStandardGroups = useMemo(() => {
    if (!showSelectedFilter) {
      return filteredStandardGroups;
    }
    return filteredStandardGroups.filter((group) => ids.includes(group.id));
  }, [filteredStandardGroups, showSelectedFilter, ids]);

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
      <SelectableGrid<StandardGroupItem>
        horizontal
        items={displayStandardGroups}
        selectedId={null}
        selectedIds={ids}
        onSelect={handleToggleSelect}
        getId={(item) => item.id}
        renderItem={(item, isSelected) => (
          <div
            className={cn(
              "relative flex flex-col gap-2 rounded-xl border bg-card p-4 text-left shadow-sm transition-all",
              "hover:shadow-md hover:bg-accent/50",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              isSelected && "ring-2 ring-primary bg-accent"
            )}
          >
            {isSelected && (
              <div className="absolute top-2 right-2 z-10 h-6 w-6 bg-primary rounded-full flex items-center justify-center">
                <Check className="h-3.5 w-3.5 text-primary-foreground" />
              </div>
            )}
            {!isSelected && isSuggested(item.id) && (
              <div className="absolute top-2 right-2 z-10 px-1.5 py-0.5 bg-primary/10 text-primary text-xs rounded">
                Suggested
              </div>
            )}
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">{item.name}</div>
              {item.description && (
                <div className="text-xs text-muted-foreground truncate">
                  {item.description}
                </div>
              )}
              {(item.points !== undefined ||
                item.pass_points !== undefined) && (
                <div className="text-xs text-muted-foreground mt-1">
                  {item.points !== undefined && `Points: ${item.points}`}
                  {item.pass_points !== undefined &&
                    ` | Pass: ${item.pass_points}`}
                </div>
              )}
            </div>
          </div>
        )}
        emptyMessage="No standard groups found. Try adjusting your search."
        disabled={disabled}
        className={displayStandardGroups.length === 0 ? "py-6" : undefined}
      />
    </div>
  );
}
