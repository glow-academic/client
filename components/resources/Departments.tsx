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
import { cn } from "@/lib/utils";
import { Check, X } from "lucide-react";
import { useCallback, useMemo } from "react";

export interface DepartmentResourceItem {
  department_id?: string | null;
  name?: string | null;
  description?: string | null;
  generated?: boolean | null;
  suggested?: boolean | null;
  pending?: boolean | null;
}

export interface DepartmentItem {
  id: string;
  name: string;
  description?: string;
}

export interface DepartmentsProps {
  department_ids?: string[]; // Current department resource IDs (standardized prop name)
  department_resources?: DepartmentResourceItem[]; // Selected department resources (each includes generated field)
  show_departments?: boolean; // Whether to show this resource picker
  departments?: DepartmentResourceItem[]; // All available departments from API (each includes generated and suggested fields)
  disabled?: boolean; // Based on can_edit flag
  onChange: (ids: string[]) => void; // Update department_ids in form state
  label?: string;
  id?: string;
  required?: boolean;
  placeholder?: string;
  description?: string;
  aiDepartmentResources?: Array<{
    department_id?: string | null;
    name?: string | null;
  }> | null;
  /** Per-field pending lifecycle (multi-select). Receives the full set
   *  of pending ids being decided in this click. Parent should remove
   *  them from ``pending_ids``; reject also removes them from
   *  ``department_ids``. */
  onAcceptPending?: (pendingIds: string[]) => void;
  onRejectPending?: (pendingIds: string[]) => void;
  // Legacy props for backward compatibility
  departmentIds?: string[];
}

export function Departments({
  department_ids,
  department_resources: _department_resources,
  show_departments = false,
  departments,
  disabled = false,
  onChange,
  label = "Departments",
  id = "departments",
  required = false,
  placeholder: _placeholder = "Select departments...",
  description,
  aiDepartmentResources: _aiDepartmentResources,
  onAcceptPending,
  onRejectPending,
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

  // Pending state: items with pending=true from soft draft connections
  const pendingItems = useMemo(() => {
    return allDepartments.filter((d) => d.pending && d.department_id);
  }, [allDepartments]);
  const showDiff = pendingItems.length > 0;
  const pendingIds = useMemo(
    () => new Set(pendingItems.map((d) => d.department_id).filter(Boolean) as string[]),
    [pendingItems]
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

  // Check if a department is suggested (derived from item.suggested field)
  const isSuggested = useCallback(
    (departmentId: string) => {
      const dept = allDepartments.find((d) => d.department_id === departmentId);
      return dept?.suggested === true;
    },
    [allDepartments]
  );

  const handleSelect = useCallback(
    (selectedIds: string[]) => {
      onChange(selectedIds);
    },
    [onChange]
  );

  // Accept pending — pending items stay in ``ids`` (already selected).
  // The parent hook removes them from ``pending_ids`` so the next save
  // promotes the connections to active=true. Without the hook we fall
  // through to a no-op (legacy behavior).
  const handleAccept = useCallback(() => {
    if (onAcceptPending && pendingIds.size > 0) {
      onAcceptPending(Array.from(pendingIds));
    }
  }, [onAcceptPending, pendingIds]);

  // Reject pending — drop them from selection AND tell the parent to
  // strip them from ``pending_ids``. Falls back to the local-only
  // behavior when no hook is provided.
  const handleReject = useCallback(() => {
    const newIds = ids.filter((id) => !pendingIds.has(id));
    if (onRejectPending && pendingIds.size > 0) {
      onRejectPending(Array.from(pendingIds));
    } else {
      onChange(newIds);
    }
  }, [ids, pendingIds, onRejectPending, onChange]);

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
          const isPending = pendingIds.has(item.id);

          return (
            <div
              className={cn(
                "relative flex flex-col p-3 rounded-xl border bg-card text-card-foreground shadow-sm transition-all text-left h-[88px]",
                "hover:shadow-md hover:bg-accent/50",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                isSelected && !isPending && "ring-2 ring-primary bg-accent",
                isPending && "ring-2 ring-success bg-success/10",
              )}
            >
              {/* Check icon - top right */}
              {isSelected && !isPending && (
                <div className="absolute top-2 right-2 z-10 h-5 w-5 bg-primary rounded-full flex items-center justify-center">
                  <Check className="h-3 w-3 text-primary-foreground" />
                </div>
              )}

              {/* Pending badge - top right */}
              {isPending && (
                <div className="absolute top-2 right-2 z-10 px-1.5 py-0.5 bg-success/20 text-success text-[10px] rounded font-medium">
                  Pending
                </div>
              )}

              {/* Suggested dot indicator - top right */}
              {isSuggested(item.id) && !isSelected && !isPending && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="absolute top-2 right-2 z-10 h-1.5 w-1.5 rounded-full bg-primary" />
                    </TooltipTrigger>
                    <TooltipContent side="top">Suggested</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}

              <div className="flex flex-col justify-center gap-1 flex-1 overflow-hidden">
                <span className="text-sm font-medium truncate">
                  {item.name}
                </span>
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
