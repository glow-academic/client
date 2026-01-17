/**
 * Groups.tsx
 * Resource component for group selection
 * Uses GenericPicker to select existing group resources
 * Manages group_ids array and reports to parent
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

type CreateDraftGroupsIn = InputOf<"/api/v4/resources/groups", "post">;
type CreateDraftGroupsOut = OutputOf<"/api/v4/resources/groups", "post">;

export interface GroupItem {
  id: string;
  name: string;
  description?: string;
}

export interface GroupsProps {
  group_ids?: string[]; // Current group resource IDs (standardized prop name)
  group_resources?: Array<{
    group_id: string | null;
    name: string | null;
    description?: string | null;
    generated?: boolean | null;
  }>; // Selected group resources (each includes generated field)
  show_groups?: boolean; // Whether to show this resource picker
  group_suggestions?: string[]; // Array of suggested resource IDs (UUIDs)
  groups?: Array<{
    group_id: string | null;
    name: string | null;
    description?: string | null;
    generated?: boolean | null;
  }>; // All available groups from API (each includes generated field)
  disabled?: boolean; // Based on can_edit flag
  onChange: (ids: string[]) => void; // Update group_ids in form state
  label?: string;
  id?: string;
  required?: boolean;
  placeholder?: string;
  description?: string;
  group_id?: string | null; // Group ID for linking resources
  agent_id?: string | null; // Agent ID for resource creation
  createGroupsAction?:
    | ((input: CreateDraftGroupsIn) => Promise<CreateDraftGroupsOut>)
    | undefined;
  onGenerate?: () => void | Promise<void>;
  isGenerating?: boolean;
}

export function Groups({
  group_ids,
  group_resources,
  show_groups = false,
  group_suggestions,
  groups,
  disabled = false,
  onChange,
  label = "Groups",
  id = "groups",
  required = false,
  placeholder = "Select groups...",
  description,
  group_id,
  agent_id,
  createGroupsAction,
  onGenerate,
  isGenerating = false,
}: GroupsProps) {
  const ids = useMemo(() => group_ids ?? [], [group_ids]);
  const show = show_groups ?? false;
  const allGroups = useMemo(() => groups ?? [], [groups]);
  const suggestionsList = useMemo(
    () => group_suggestions ?? [],
    [group_suggestions]
  );

  // Track which group IDs have already had resources created
  const createdGroupIdsRef = useRef<Set<string>>(new Set());

  // Initialize createdGroupIdsRef with current IDs
  useEffect(() => {
    ids.forEach((id) => createdGroupIdsRef.current.add(id));
  }, [ids]);

  // Convert groups array to GroupItem format for GenericPicker
  const groupItems = useMemo(() => {
    return allGroups
      .filter((g) => g.group_id && g.name) // Filter out nulls
      .map((g) => ({
        id: g.group_id!,
        name: g.name!,
        ...(g.description ? { description: g.description } : {}),
      }));
  }, [allGroups]);

  // Check if a group is suggested
  const isSuggested = useCallback(
    (groupId: string) => suggestionsList.includes(groupId),
    [suggestionsList]
  );

  const handleSelect = useCallback(
    async (selectedIds: string[]) => {
      // Find newly selected IDs
      const newlySelected = selectedIds.filter(
        (id) => !ids.includes(id) && !createdGroupIdsRef.current.has(id)
      );

      // Create resources for newly selected groups
      if (
        newlySelected.length > 0 &&
        createGroupsAction &&
        agent_id &&
        group_id
      ) {
        for (const groupId of newlySelected) {
          try {
            await createGroupsAction({
              body: {
                agent_id: agent_id,
                group_id: groupId,
                mcp: false,
              },
            });
            createdGroupIdsRef.current.add(groupId);
          } catch (error) {
            // eslint-disable-next-line no-console
            console.error(
              `Failed to create group resource for ${groupId}:`,
              error
            );
            // Don't block UI - still update selection
          }
        }
      }

      // Update parent state
      onChange(selectedIds);
    },
    [ids, onChange, createGroupsAction, agent_id, group_id]
  );

  // Check if any group resource is generated (must be before early return)
  const hasGenerated = useMemo(() => {
    return group_resources?.some((g) => g.generated) ?? false;
  }, [group_resources]);

  // Don't render if show_groups is false (AFTER all hooks)
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
      <GenericPicker<GroupItem>
        items={groupItems}
        itemIds={allGroups
          .map((g) => g.group_id)
          .filter((id): id is string => id !== null)} // All group IDs from array, filter nulls
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
