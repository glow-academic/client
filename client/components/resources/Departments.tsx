/**
 * Departments.tsx
 * Resource component for department selection
 * Uses SelectableGrid to display departments as horizontal scrollable cards
 * Manages department_ids array and reports to parent
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
import { useResourceAi } from "@/hooks/use-resource-ai";
import { cn } from "@/lib/utils";
import type { OutputOf } from "@/lib/api/types";
import { Check, Loader2, Sparkles, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// Derive resource item type from the GET endpoint response
type DepartmentsGetResponse = OutputOf<"/api/v4/resources/departments/get", "post">;
export type DepartmentResourceItem = NonNullable<DepartmentsGetResponse["items"]>[number];

type CreateDraftDepartmentsIn = {
  body: {
    group_id: string;
    department_id: string;
    mcp?: boolean;
  };
};
type CreateDraftDepartmentsOut = {
  id?: string | null;
};

export interface DepartmentItem {
  id: string;
  name: string;
  description?: string;
}

export interface DepartmentsProps {
  department_ids?: string[]; // Current department resource IDs (standardized prop name)
  department_resources?: DepartmentResourceItem[]; // Selected department resources (each includes generated field)
  show_departments?: boolean; // Whether to show this resource picker
  department_suggestions?: string[]; // Array of suggested resource IDs (UUIDs)
  departments?: DepartmentResourceItem[]; // All available departments from API (each includes generated field)
  disabled?: boolean; // Based on can_edit flag
  onChange: (ids: string[]) => void; // Update department_ids in form state
  label?: string;
  id?: string;
  required?: boolean;
  placeholder?: string;
  description?: string;
  group_id?: string | null; // Group ID for linking resources
  showAiGenerate?: boolean; // Whether to show AI generate button (computed server-side)
  createDepartmentsAction?:
    | ((input: CreateDraftDepartmentsIn) => Promise<CreateDraftDepartmentsOut>)
    | undefined;
  onGenerate?: () => void | Promise<void>;
  isGenerating?: boolean;
  /** When false, skip automatic resource creation (manual save mode) */
  isAutosaveEnabled?: boolean;
  /** Register a flush callback with parent for manual save - returns created IDs */
  registerFlush?: (flush: () => Promise<{ department_ids: string[] } | void>) => void;
  // AI diff view props
  aiDepartmentResources?: Array<{
    department_id?: string | null;
    name?: string | null;
  }> | null;
  onAccept?: () => void;
  onReject?: () => void;
  onGenerationComplete?: () => void;
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
  placeholder: _placeholder = "Select departments...",
  description,
  group_id,
  showAiGenerate = false,
  createDepartmentsAction,
  onGenerate,
  isGenerating = false,
  isAutosaveEnabled = true,
  registerFlush,
  // AI diff view props
  aiDepartmentResources,
  onAccept,
  onReject,
  onGenerationComplete,
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

  // Socket-based AI suggestion handling via shared hook
  const { isGenerating: aiIsGenerating, aiSuggestions, accept: acceptAi, reject: rejectAi } = useResourceAi<{
    department_id: string | null;
    name: string | null;
  }>({
    resourceType: "departments",
    groupId: group_id,
    extractSuggestion: (data) => {
      if (!data.success && data.success !== undefined) return null;
      return { department_id: (data.department_id as string) ?? null, name: (data.name as string) ?? null };
    },
    accumulate: true,
  });

  // AI suggestion state
  const showDiff = aiSuggestions.length > 0;
  const aiSuggestedIds = useMemo(
    () =>
      new Set(
        aiSuggestions
          .map((d) => d.department_id)
          .filter(Boolean) as string[]
      ),
    [aiSuggestions]
  );

  // Track which department IDs have already had resources created
  const createdDepartmentIdsRef = useRef<Set<string>>(new Set());

  // Initialize createdDepartmentIdsRef with current IDs
  useEffect(() => {
    ids.forEach((id) => createdDepartmentIdsRef.current.add(id));
  }, [ids]);

  // Ref for flush function (stable reference for registerFlush)
  const flushRef = useRef<(() => Promise<{ department_ids: string[] } | void>) | undefined>(undefined);

  // Update flush function when dependencies change
  flushRef.current = async (): Promise<{ department_ids: string[] } | void> => {
    if (!createDepartmentsAction || !group_id) {
      return { department_ids: ids };
    }

    // Create resources for any uncreated department IDs
    const uncreatedIds = ids.filter((id) => !createdDepartmentIdsRef.current.has(id));
    for (const departmentId of uncreatedIds) {
      try {
        await createDepartmentsAction({
          body: {
            group_id: group_id,
            department_id: departmentId,
            mcp: false,
          },
        });
        createdDepartmentIdsRef.current.add(departmentId);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error(`Failed to create department resource for ${departmentId}:`, error);
      }
    }

    return { department_ids: ids };
  };

  // Register flush callback with parent
  useEffect(() => {
    if (registerFlush) {
      registerFlush(() => flushRef.current?.() ?? Promise.resolve());
    }
  }, [registerFlush]);

  // Convert departments array to DepartmentItem format for SelectableGrid
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

      // Create resources for newly selected departments (only if autosave enabled)
      if (
        isAutosaveEnabled &&
        newlySelected.length > 0 &&
        createDepartmentsAction &&
        group_id
      ) {
        for (const departmentId of newlySelected) {
          try {
            await createDepartmentsAction({
              body: {
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
    [ids, onChange, createDepartmentsAction, group_id, isAutosaveEnabled]
  );

  // Accept AI suggestion - add AI-suggested departments to selection
  const handleAccept = useCallback(() => {
    if (aiSuggestions.length === 0) return;
    const newIds = aiSuggestions
      .map((d) => d.department_id)
      .filter((id): id is string => !!id && !ids.includes(id));
    if (newIds.length > 0) {
      onChange([...ids, ...newIds]);
    }
    acceptAi();
  }, [aiSuggestions, ids, onChange, acceptAi]);

  // Reject AI suggestion - just clear the pending state
  const handleReject = useCallback(() => {
    rejectAi();
  }, [rejectAi]);

  // Check if any department resource is generated (must be before early return)
  const hasGenerated = useMemo(() => {
    return department_resources?.some((d) => d.generated) ?? false;
  }, [department_resources]);

  // Don't render if show_departments is false (AFTER all hooks)
  if (!show) {
    return null;
  }

  return (
    <div className="space-y-4 min-w-0 w-full">
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
          {onGenerate && showAiGenerate && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={onGenerate}
                    disabled={disabled || aiIsGenerating || showDiff}
                  >
                    {aiIsGenerating ? (
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

      <SelectableGrid<DepartmentItem>
        items={departmentItems}
        selectedId={null}
        selectedIds={ids}
        onSelect={(departmentId) => {
          // Toggle selection for multi-select
          const newIds = ids.includes(departmentId)
            ? ids.filter((id) => id !== departmentId)
            : [...ids, departmentId];
          handleSelect(newIds);
        }}
        getId={(item) => item.id}
        renderItem={(item, isSelected) => {
          const isAiSuggested = showDiff && aiSuggestedIds.has(item.id);

          return (
            <div
              className={cn(
                "relative flex flex-col p-3 rounded-xl border bg-card text-card-foreground shadow-sm transition-all text-left h-[88px]",
                "hover:shadow-md hover:bg-accent/50",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                isSelected && "ring-2 ring-primary bg-accent",
                isAiSuggested && !isSelected && "ring-2 ring-success bg-success/10"
              )}
            >
              {/* Check icon - top right */}
              {isSelected && (
                <div className="absolute top-2 right-2 z-10 h-5 w-5 bg-primary rounded-full flex items-center justify-center">
                  <Check className="h-3 w-3 text-primary-foreground" />
                </div>
              )}

              {/* AI suggested badge - top right */}
              {isAiSuggested && !isSelected && (
                <div className="absolute top-2 right-2 z-10 px-1.5 py-0.5 bg-success/20 text-success text-[10px] rounded font-medium">
                  AI Suggested
                </div>
              )}

              {/* Suggested badge - top right */}
              {isSuggested(item.id) && !isSelected && !isAiSuggested && (
                <div className="absolute top-2 right-2 z-10 px-1.5 py-0.5 bg-primary/10 text-primary text-[10px] rounded">
                  Suggested
                </div>
              )}

              <div className="flex flex-col justify-center gap-1 flex-1 overflow-hidden">
                <span className="text-sm font-medium truncate">{item.name}</span>
                {item.description && (
                  <span className="text-xs text-muted-foreground line-clamp-2">
                    {item.description}
                  </span>
                )}
              </div>
            </div>
          );
        }}
        emptyMessage="No departments available."
        disabled={disabled}
        horizontal
      />
    </div>
  );
}
