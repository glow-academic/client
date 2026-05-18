/**
 * Tools.tsx
 * Resource component for tools selection
 * Uses SelectableGrid to select existing tools resources
 * Manages tool_ids array and reports to parent
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

export interface ToolResourceItem {
  id?: string | null;
  name?: string | null;
  description?: string | null;
  generated?: boolean | null;
  suggested?: boolean | null;
  pending?: boolean | null;
}

export interface ToolsItem {
  id: string;
  name: string;
  description?: string;
}

export interface ToolsProps {
  tool_ids?: string[]; // Current tools resource IDs (standardized prop name)
  tool_resources?: ToolResourceItem[]; // Selected tools resources
  show_tools?: boolean; // Whether to show this resource picker
  tools?: ToolResourceItem[]; // All available tools from API
  disabled?: boolean; // Based on can_edit flag
  onChange: (ids: string[]) => void; // Update tool_ids in form state
  label?: string;
  id?: string;
  required?: boolean;
  placeholder?: string;
  description?: string;
  searchTerm?: string; // Search term for filtering tools
  onSearchChange?: (term: string) => void; // Callback when search term changes
  showSelectedFilter?: boolean; // Whether to show only selected tools
  onShowSelectedChange?: (value: boolean) => void; // Callback when show selected filter changes
}

export function Tools({
  tool_ids,
  show_tools = false,
  tools,
  disabled = false,
  onChange,
  label = "Tools",
  id = "tools",
  required = false,
  description,
  searchTerm = "",
  showSelectedFilter = false,
}: ToolsProps) {
  const ids = useMemo(() => tool_ids ?? [], [tool_ids]);
  const show = show_tools ?? false;
  const allTools = useMemo(() => tools ?? [], [tools]);

  // Pending state: items with pending=true from soft draft connections
  const pendingItems = useMemo(() => {
    return allTools.filter((t) => t.pending && t.id);
  }, [allTools]);
  const showDiff = pendingItems.length > 0;
  const pendingIds = useMemo(
    () => new Set(pendingItems.map((t) => t.id).filter(Boolean) as string[]),
    [pendingItems]
  );

  // Convert tools array to ToolsItem format for SelectableGrid
  const toolsItems = useMemo(() => {
    return allTools
      .filter((m) => m.id && m.name) // Filter out nulls
      .map((m) => ({
        id: m.id!,
        name: m.name!,
        ...(m.description ? { description: m.description } : {}),
      }));
  }, [allTools]);

  // Filter tools by search term
  const filteredTools = useMemo(() => {
    if (!searchTerm.trim()) {
      return toolsItems;
    }
    const searchLower = searchTerm.toLowerCase();
    return toolsItems.filter(
      (tool) =>
        tool.name.toLowerCase().includes(searchLower) ||
        (tool.description &&
          tool.description.toLowerCase().includes(searchLower))
    );
  }, [toolsItems, searchTerm]);

  // Filter by showSelected if enabled
  const displayTools = useMemo(() => {
    if (!showSelectedFilter) {
      return filteredTools;
    }
    return filteredTools.filter((tool) => ids.includes(tool.id));
  }, [filteredTools, showSelectedFilter, ids]);

  // Check if a tool is suggested (derived from item.suggested field)
  const isSuggested = useCallback(
    (toolId: string) => {
      const tool = allTools.find((t) => t.id === toolId);
      return tool?.suggested === true;
    },
    [allTools]
  );

  const handleSelect = useCallback(
    (toolId: string) => {
      // Toggle selection: if already selected, remove it; otherwise add it
      const isSelected = ids.includes(toolId);
      const newIds = isSelected
        ? ids.filter((id) => id !== toolId)
        : [...ids, toolId];
      onChange(newIds);
    },
    [ids, onChange]
  );

  // Accept pending — keep pending tools in selection
  const handleAccept = useCallback(() => {
    // Pending items are already in ids (selected=true), just confirm
    // The next draft save will persist them as active
    // Nothing to change in form state — they're already included
  }, []);

  // Reject pending — remove pending tools from selection
  const handleReject = useCallback(() => {
    const newIds = ids.filter((id) => !pendingIds.has(id));
    onChange(newIds);
  }, [ids, pendingIds, onChange]);

  // Don't render if show_tools is false (AFTER all hooks)
  if (!show) {
    return null;
  }

  return (
    <div className="space-y-4">
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
      <SelectableGrid<ToolsItem>
        horizontal
        items={displayTools}
        selectedId={null}
        selectedIds={ids}
        onSelect={handleSelect}
        getId={(item) => item.id}
        renderItem={(item, isSelected) => {
          const isPending = showDiff && pendingIds.has(item.id);

          return (
            <div
              className={cn(
                "relative flex flex-col gap-3 p-4 rounded-xl border bg-card text-card-foreground shadow-sm transition-all text-left",
                "hover:shadow-md hover:bg-accent/50",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                isSelected && !isPending && "ring-2 ring-primary bg-accent",
                isPending && "ring-2 ring-success bg-success/10",
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

              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-sm leading-tight">{item.name}</h3>
                {item.description && (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    {item.description}
                  </p>
                )}
              </div>
            </div>
          );
        }}
        emptyMessage="No tools found."
        disabled={disabled}
      />
    </div>
  );
}
