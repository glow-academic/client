/**
 * Departments.tsx
 * Resource component for department selection
 * Uses GenericPicker to select existing department resources
 * Manages department_ids array and reports to parent
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

type CreateDraftDepartmentsIn = InputOf<
  "/api/v4/resources/departments",
  "post"
>;
type CreateDraftDepartmentsOut = OutputOf<
  "/api/v4/resources/departments",
  "post"
>;

export interface DepartmentItem {
  id: string;
  name: string;
  description?: string;
}

export interface DepartmentsProps {
  department_ids?: string[]; // Current department resource IDs (standardized prop name)
  department_resources?: Array<{
    department_id: string | null;
    name: string | null;
    description?: string | null;
    generated?: boolean | null;
  }>; // Selected department resources (each includes generated field)
  show_departments?: boolean; // Whether to show this resource picker
  department_suggestions?: string[]; // Array of suggested resource IDs (UUIDs)
  departments?: Array<{
    department_id: string | null;
    name: string | null;
    description?: string | null;
    generated?: boolean | null;
  }>; // All available departments from API (each includes generated field)
  disabled?: boolean; // Based on can_edit flag
  onChange: (ids: string[]) => void; // Update department_ids in form state
  label?: string;
  id?: string;
  required?: boolean;
  placeholder?: string;
  description?: string;
  group_id?: string | null; // Group ID for linking resources
  agent_id?: string | null; // Agent ID for resource creation
  createDepartmentsAction?:
    | ((input: CreateDraftDepartmentsIn) => Promise<CreateDraftDepartmentsOut>)
    | undefined;
  onGenerate?: () => void | Promise<void>;
  isGenerating?: boolean;
  // Legacy props for backward compatibility
  departmentIds?: string[];
}

export function Departments({
  department_ids,
  department_resources,
  show_departments = false,
  department_suggestions,
  departments,
  disabled = false,
  onChange,
  label = "Departments",
  id = "departments",
  required = false,
  placeholder = "Select departments...",
  description,
  group_id,
  agent_id,
  createDepartmentsAction,
  onGenerate,
  isGenerating = false,
  // Legacy props for backward compatibility
  departmentIds,
}: DepartmentsProps) {
  // Use standardized props with fallback to legacy props
  const ids = useMemo(
    () => department_ids ?? departmentIds ?? [],
    [department_ids, departmentIds]
  );
  const show = show_departments ?? false;
  const allDepartments = useMemo(() => departments ?? [], [departments]);
  const suggestionsList = useMemo(
    () => department_suggestions ?? [],
    [department_suggestions]
  );

  // Track which department IDs have already had resources created
  const createdDepartmentIdsRef = useRef<Set<string>>(new Set());

  // Initialize createdDepartmentIdsRef with current IDs
  useEffect(() => {
    ids.forEach((id) => createdDepartmentIdsRef.current.add(id));
  }, [ids]);

  // Convert departments array to DepartmentItem format for GenericPicker
  const departmentItems = useMemo(() => {
    return allDepartments
      .filter((d) => d.department_id && d.name) // Filter out nulls
      .map((d) => ({
        id: d.department_id!,
        name: d.name!,
        ...(d.description ? { description: d.description } : {}), // Only include if not null/undefined
      }));
  }, [allDepartments]);

  // Check if a department is suggested
  const isSuggested = useCallback(
    (departmentId: string) => suggestionsList.includes(departmentId),
    [suggestionsList]
  );

  const handleSelect = useCallback(
    async (selectedIds: string[]) => {
      // Find newly selected IDs
      const newlySelected = selectedIds.filter(
        (id) => !ids.includes(id) && !createdDepartmentIdsRef.current.has(id)
      );

      // Create resources for newly selected departments
      if (
        newlySelected.length > 0 &&
        createDepartmentsAction &&
        agent_id &&
        group_id
      ) {
        for (const departmentId of newlySelected) {
          try {
            await createDepartmentsAction({
              body: {
                agent_id: agent_id,
                group_id: group_id,
                department_id: departmentId,
                mcp: false,
              },
            });
            createdDepartmentIdsRef.current.add(departmentId);
          } catch (error) {
            // eslint-disable-next-line no-console
            console.error(
              `Failed to create department resource for ${departmentId}:`,
              error
            );
            // Don't block UI - still update selection
          }
        }
      }

      // Update parent state
      onChange(selectedIds);
    },
    [ids, onChange, createDepartmentsAction, agent_id, group_id]
  );

  // Check if any department resource is generated (must be before early return)
  const hasGenerated = useMemo(() => {
    return department_resources?.some((d) => d.generated) ?? false;
  }, [department_resources]);

  // Don't render if show_departments is false (AFTER all hooks)
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
      <GenericPicker<DepartmentItem>
        items={departmentItems}
        itemIds={allDepartments
          .map((d) => d.department_id)
          .filter((id): id is string => id !== null)} // All department IDs from array, filter nulls
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
