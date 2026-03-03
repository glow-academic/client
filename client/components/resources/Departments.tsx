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
import type { InputOf, OutputOf } from "@/lib/api/types";
import { Check, Loader2, Sparkles, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef } from "react";

type LinkDepartmentsIn = InputOf<"/api/v5/resources/departments/link", "post">;
type LinkDepartmentsOut = OutputOf<"/api/v5/resources/departments/link", "post">;

// Derive resource item type from the GET endpoint response
type DepartmentsGetResponse = OutputOf<"/api/v5/resources/departments/get", "post">;
export type DepartmentResourceItem = NonNullable<DepartmentsGetResponse["items"]>[number];

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
  link_tool_id?: string | null; // Tool ID for link tracking
  showAiGenerate?: boolean; // Whether to show AI generate button (computed server-side)
  onGenerate?: () => void | Promise<void>;
  linkDepartmentAction?: ((input: LinkDepartmentsIn) => Promise<LinkDepartmentsOut>) | undefined;
  /** When false, skip automatic link tracking (manual save mode) */
  isAutosaveEnabled?: boolean;
  /** Register a flush callback with parent for manual save */
  registerFlush?: (flush: () => Promise<{ department_ids: string[] } | void>) => void;
  aiDepartmentResources?: Array<{
    department_id?: string | null;
    name?: string | null;
  }> | null;
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
  link_tool_id,
  showAiGenerate = false,
  onGenerate,
  linkDepartmentAction,
  isAutosaveEnabled = true,
  registerFlush,
  aiDepartmentResources: _aiDepartmentResources,
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

  // --- Flush / Link tracking ---
  const lastLinkedIdsRef = useRef<string[]>(ids);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isInitialMountRef = useRef(true);

  const flushRef = useRef<(() => Promise<{ department_ids: string[] } | void>) | undefined>(undefined);

  flushRef.current = async (): Promise<{ department_ids: string[] } | void> => {
    if (!linkDepartmentAction || !group_id || !link_tool_id) return;
    // Find newly added IDs since last link
    const prevSet = new Set(lastLinkedIdsRef.current);
    const newIds = ids.filter((id) => !prevSet.has(id));

    if (newIds.length === 0 && ids.length === lastLinkedIdsRef.current.length) {
      return { department_ids: ids };
    }

    try {
      // Link each newly added department
      for (const deptId of newIds) {
        await linkDepartmentAction({
          body: {
            group_id: group_id,
            resource_id: deptId,
            tool_id: link_tool_id,
          },
        });
      }
      lastLinkedIdsRef.current = [...ids];
      return { department_ids: ids };
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Failed to link department resource:", error);
      throw error;
    }
  };

  useEffect(() => {
    if (registerFlush) {
      registerFlush(() => flushRef.current?.() ?? Promise.resolve());
    }
  }, [registerFlush]);

  // Stable serialization for deps
  const idsKey = ids.join(",");

  // Track pending changes for manual save mode
  useEffect(() => {
    if (isAutosaveEnabled) return;
    if (isInitialMountRef.current) return;

    const hasPendingChanges = idsKey !== lastLinkedIdsRef.current.join(",");
    if (hasPendingChanges) {
      window.dispatchEvent(
        new CustomEvent("unsaved-changes", { detail: { hasChanges: true } })
      );
    }
  }, [idsKey, isAutosaveEnabled]);

  // Debounced link tracking when autosave is enabled
  useEffect(() => {
    if (!isAutosaveEnabled) return;
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      lastLinkedIdsRef.current = [...ids];
      return;
    }
    if (idsKey === lastLinkedIdsRef.current.join(",")) return;
    if (!linkDepartmentAction) return;

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

    debounceTimerRef.current = setTimeout(() => {
      flushRef.current?.();
    }, 1000);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [idsKey, linkDepartmentAction, isAutosaveEnabled, ids]);

  // Socket-based AI suggestion handling via shared hook
  const { isGenerating: aiIsGenerating, aiSuggestions, clear: clearAi } = useResourceAi({
    resourceType: "departments",
    groupId: group_id,
    accumulate: true,
  });

  // AI suggestion state
  const showDiff = aiSuggestions.length > 0;
  const aiSuggestedIds = useMemo(
    () =>
      new Set(
        aiSuggestions
          .map((d) => d.id)
          .filter(Boolean) as string[]
      ),
    [aiSuggestions]
  );

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
    (selectedIds: string[]) => {
      onChange(selectedIds);
    },
    [onChange]
  );

  // Accept AI suggestion - add AI-suggested departments to selection
  const handleAccept = useCallback(() => {
    if (aiSuggestions.length === 0) return;
    const newIds = aiSuggestions
      .map((d) => d.id)
      .filter((id): id is string => !!id && !ids.includes(id));
    if (newIds.length > 0) {
      onChange([...ids, ...newIds]);
    }
    clearAi();
  }, [aiSuggestions, ids, onChange, clearAi]);

  // Reject AI suggestion - just clear the pending state
  const handleReject = useCallback(() => {
    clearAi();
  }, [clearAi]);

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
