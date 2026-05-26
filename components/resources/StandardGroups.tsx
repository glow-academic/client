/**
 * StandardGroups.tsx
 * Resource component for standard group selection
 * Uses SelectableGrid to select existing standard group resources
 * Manages standard_group_ids array and reports to parent
 */

"use client";

import { SelectableGrid } from "@/components/common/forms/SelectableGrid";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Check, Plus, X } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

export interface StandardGroupResourceItem {
  standard_group_id?: string | null;
  name?: string | null;
  description?: string | null;
  points?: number | null;
  pass_points?: number | null;
  position?: number | null;
  active?: boolean | null;
  standard_ids?: string[] | null;
  generated?: boolean | null;
  suggested?: boolean | null;
  pending?: boolean | null;
}

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

export interface StandardGroupDraft {
  name: string;
  description: string;
  points: number;
  pass_points: number;
}

export interface StandardGroupsProps {
  standard_group_ids?: string[]; // Current standard group resource IDs (standardized prop name)
  standard_group_resources?: StandardGroupResourceItem[]; // Selected standard group resources (each includes generated field)
  show_standard_groups?: boolean; // Whether to show this resource picker
  standard_groups?: StandardGroupResourceItem[]; // All available standard groups from API (each includes generated and suggested fields)
  disabled?: boolean; // Based on can_edit flag
  onChange: (ids: string[]) => void; // Update standard_group_ids in form state
  onCreate?: (draft: StandardGroupDraft) => void; // Optional inline-create handler
  label?: string;
  id?: string;
  required?: boolean;
  description?: string;
  searchTerm?: string;
  showSelectedFilter?: boolean;
  /** Per-field pending lifecycle (multi-select). See Departments.tsx. */
  onAcceptPending?: (pendingIds: string[]) => void;
  onRejectPending?: (pendingIds: string[]) => void;
  // Legacy props — accepted for backward compat but unused after pending migration
  standardGroupIds?: string[];
}

export function StandardGroups({
  standard_group_ids,
  standard_group_resources: _standard_group_resources,
  show_standard_groups = false,
  standard_groups,
  disabled = false,
  onChange,
  onCreate,
  label = "Standard Groups",
  id = "standard_groups",
  required = false,
  description,
  searchTerm = "",
  showSelectedFilter = false,
  onAcceptPending,
  onRejectPending,
  // Legacy props — accepted for backward compat but unused after pending migration
  standardGroupIds,
}: StandardGroupsProps) {
  // Inline-create form state. Collapsed by default; opens via + New group.
  const [createOpen, setCreateOpen] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [draftDescription, setDraftDescription] = useState("");
  const [draftPoints, setDraftPoints] = useState<string>("4");
  const [draftPassPoints, setDraftPassPoints] = useState<string>("3");

  const resetDraft = useCallback(() => {
    setDraftName("");
    setDraftDescription("");
    setDraftPoints("4");
    setDraftPassPoints("3");
  }, []);

  const handleCreateSubmit = useCallback(() => {
    const name = draftName.trim();
    if (!name || !onCreate) return;
    const points = Number.parseInt(draftPoints, 10);
    const passPoints = Number.parseInt(draftPassPoints, 10);
    onCreate({
      name,
      description: draftDescription.trim(),
      points: Number.isFinite(points) ? points : 0,
      pass_points: Number.isFinite(passPoints) ? passPoints : 0,
    });
    resetDraft();
    setCreateOpen(false);
  }, [draftName, draftDescription, draftPoints, draftPassPoints, onCreate, resetDraft]);
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

  // Pending state: items with pending=true from soft draft connections
  const pendingItems = useMemo(() => {
    return allStandardGroups.filter(
      (sg) => sg.pending && (sg.standard_group_id ?? (sg as { id?: string | null }).id)
    );
  }, [allStandardGroups]);
  const showDiff = pendingItems.length > 0;
  const pendingIds = useMemo(
    () =>
      new Set(
        pendingItems
          .map((sg) => sg.standard_group_id ?? (sg as { id?: string | null }).id)
          .filter(Boolean) as string[]
      ),
    [pendingItems]
  );

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

  // Check if a standard group is suggested (derived from item.suggested field)
  const isSuggested = useCallback(
    (standardGroupId: string) => {
      const sg = allStandardGroups.find((s) => s.standard_group_id === standardGroupId);
      return sg?.suggested === true;
    },
    [allStandardGroups]
  );

  const handleSelect = useCallback(
    (selectedIds: string[]) => {
      onChange(selectedIds);
    },
    [onChange]
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

  // Accept pending — keep pending standard groups in selection (no-op, already selected)
  const handleAccept = useCallback(() => {
    if (onAcceptPending && pendingIds.size > 0) {
      onAcceptPending(Array.from(pendingIds));
    }
    // Pending items are already in ids (selected=true), just confirm
    // The next draft save will persist them as active
    // Nothing to change in form state — they're already included
  }, [onAcceptPending, pendingIds]);

  // Reject pending — remove pending standard groups from selection
  const handleReject = useCallback(() => {
    if (onRejectPending && pendingIds.size > 0) {
      onRejectPending(Array.from(pendingIds));
      return;
    }
    const newIds = ids.filter((id) => !pendingIds.has(id));
    onChange(newIds);
  }, [ids, pendingIds, onChange, onRejectPending]);

  // Don't render if show_standard_groups is false (AFTER all hooks)
  if (!show) {
    return null;
  }

  return (
    <div className="space-y-2">
      {(label || onCreate) && (
        <div className="flex items-center gap-2">
          {label && (
            <Label htmlFor={id} className="flex items-center gap-1">
              {label}
              {required && <span className="text-destructive">*</span>}
              {description && (
                <span className="text-xs text-muted-foreground ml-2">
                  {description}
                </span>
              )}
            </Label>
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
          {onCreate && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="ml-auto"
              onClick={() => setCreateOpen((v) => !v)}
              disabled={disabled}
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              {createOpen ? "Cancel" : "New group"}
            </Button>
          )}
        </div>
      )}

      {onCreate && createOpen && (
        <div className="rounded-md border bg-card p-3 space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor={`${id}-new-name`} className="text-xs">
                Name
              </Label>
              <Input
                id={`${id}-new-name`}
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                placeholder="e.g. Communication"
                disabled={disabled}
                className="h-8"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`${id}-new-description`} className="text-xs">
                Description
              </Label>
              <Textarea
                id={`${id}-new-description`}
                value={draftDescription}
                onChange={(e) => setDraftDescription(e.target.value)}
                placeholder="What this group measures"
                disabled={disabled}
                className="min-h-[32px] h-8 resize-y text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`${id}-new-points`} className="text-xs">
                Points (max)
              </Label>
              <Input
                id={`${id}-new-points`}
                type="number"
                min={0}
                value={draftPoints}
                onChange={(e) => setDraftPoints(e.target.value)}
                disabled={disabled}
                className="h-8"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`${id}-new-pass-points`} className="text-xs">
                Pass points
              </Label>
              <Input
                id={`${id}-new-pass-points`}
                type="number"
                min={0}
                value={draftPassPoints}
                onChange={(e) => setDraftPassPoints(e.target.value)}
                disabled={disabled}
                className="h-8"
              />
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                resetDraft();
                setCreateOpen(false);
              }}
              disabled={disabled}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleCreateSubmit}
              disabled={disabled || !draftName.trim()}
            >
              Add group
            </Button>
          </div>
        </div>
      )}

      <SelectableGrid<StandardGroupItem>
        horizontal
        items={displayStandardGroups}
        selectedId={null}
        selectedIds={ids}
        onSelect={handleToggleSelect}
        getId={(item) => item.id}
        renderItem={(item, isSelected) => {
          const isPending = pendingIds.has(item.id);
          return (
          <div
            className={cn(
              "relative flex flex-col gap-2 rounded-xl border bg-card p-4 text-left shadow-sm transition-all",
              "hover:shadow-md hover:bg-accent/50",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              isSelected && !isPending && "ring-2 ring-primary bg-accent",
              isPending && "ring-2 ring-success bg-success/10"
            )}
          >
            {/* Check icon - top right */}
            {isSelected && !isPending && (
              <div className="absolute top-2 right-2 z-10 h-6 w-6 bg-primary rounded-full flex items-center justify-center">
                <Check className="h-3.5 w-3.5 text-primary-foreground" />
              </div>
            )}

            {/* Pending badge - top right */}
            {isPending && (
              <div className="absolute top-2 right-2 z-10 px-1.5 py-0.5 bg-success/20 text-success text-[10px] rounded font-medium">
                Pending
              </div>
            )}

            {/* Suggested dot indicator - top right */}
            {!isSelected && !isPending && isSuggested(item.id) && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="absolute top-2 right-2 z-10 h-1.5 w-1.5 rounded-full bg-primary" />
                  </TooltipTrigger>
                  <TooltipContent side="top">Suggested</TooltipContent>
                </Tooltip>
              </TooltipProvider>
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
        )}}
        emptyMessage="No standard groups found. Try adjusting your search."
        disabled={disabled}
        {...(displayStandardGroups.length === 0 ? { className: "py-6" } : {})}
      />
    </div>
  );
}
