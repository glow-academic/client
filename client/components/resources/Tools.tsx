/**
 * Tools.tsx
 * Resource component for tools selection
 * Uses SelectableGrid to select existing tools resources
 * Manages tool_ids array and reports to parent
 */

"use client";

import { SelectableGrid } from "@/components/common/forms/SelectableGrid";
import { Label } from "@/components/ui/label";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef } from "react";

type CreateDraftToolsIn = InputOf<"/api/v4/resources/tools", "post">;
type CreateDraftToolsOut = OutputOf<"/api/v4/resources/tools", "post">;

export interface ToolsItem {
  id: string;
  name: string;
  description?: string;
}

export interface ToolsProps {
  tool_ids?: string[]; // Current tools resource IDs (standardized prop name)
  tool_resources?: Array<{
    tool_id: string | null;
    name: string | null;
    description?: string | null;
    generated?: boolean | null;
  }>; // Selected tools resources (each includes generated field)
  show_tools?: boolean; // Whether to show this resource picker
  tool_suggestions?: string[]; // Array of suggested resource IDs (UUIDs)
  tools?: Array<{
    tool_id: string | null;
    name: string | null;
    description?: string | null;
    generated?: boolean | null;
  }>; // All available tools from API (each includes generated field)
  disabled?: boolean; // Based on can_edit flag
  onChange: (ids: string[]) => void; // Update tool_ids in form state
  label?: string;
  id?: string;
  required?: boolean;
  placeholder?: string;
  description?: string;
  group_id?: string | null; // Group ID for linking resources
  link_tool_id?: string | null; // Tool ID for AI link suggestions
  onGenerate?: () => void | Promise<void>;
  isGenerating?: boolean;
  searchTerm?: string; // Search term for filtering tools
  onSearchChange?: (term: string) => void; // Callback when search term changes
  showSelectedFilter?: boolean; // Whether to show only selected tools
  onShowSelectedChange?: (value: boolean) => void; // Callback when show selected filter changes
}

export function Tools({
  tool_ids,
  tool_resources,
  show_tools = false,
  tool_suggestions,
  tools,
  disabled = false,
  onChange,
  label = "Tools",
  id = "tools",
  required = false,
  placeholder = "Select tools...",
  description,
  group_id,
  link_tool_id,
  onGenerate,
  isGenerating = false,
  searchTerm = "",
  onSearchChange,
  showSelectedFilter = false,
  onShowSelectedChange,
}: ToolsProps) {
  const ids = useMemo(() => tool_ids ?? [], [tool_ids]);
  const show = show_tools ?? false;
  const allTools = useMemo(() => tools ?? [], [tools]);
  const suggestionsList = useMemo(
    () => tool_suggestions ?? [],
    [tool_suggestions]
  );

  // Track which tools IDs have already had resources created
  const createdToolsIdsRef = useRef<Set<string>>(new Set());

  // Initialize createdToolsIdsRef with current IDs
  useEffect(() => {
    ids.forEach((id) => createdToolsIdsRef.current.add(id));
  }, [ids]);

  // Handle search term changes
  useEffect(() => {
    if (onSearchChange && searchTerm !== undefined) {
      onSearchChange(searchTerm);
    }
  }, [searchTerm, onSearchChange]);

  // Handle showSelected filter changes
  useEffect(() => {
    if (onShowSelectedChange && showSelectedFilter !== undefined) {
      onShowSelectedChange(showSelectedFilter);
    }
  }, [showSelectedFilter, onShowSelectedChange]);

  // Convert tools array to ToolsItem format for SelectableGrid
  const toolsItems = useMemo(() => {
    return allTools
      .filter((m) => m.tool_id && m.name) // Filter out nulls
      .map((m) => ({
        id: m.tool_id!,
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

  // Check if a tool is suggested
  const isSuggested = useCallback(
    (toolId: string) => suggestionsList.includes(toolId),
    [suggestionsList]
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

  // Don't render if show_tools is false (AFTER all hooks)
  if (!show) {
    return null;
  }

  return (
    <div className="space-y-4">
      <Label htmlFor={id} className="flex items-center gap-1">
        {label}
        {required && <span className="text-destructive">*</span>}
      </Label>
      <SelectableGrid<ToolsItem>
        horizontal
        items={displayTools}
        selectedId={null}
        selectedIds={ids}
        onSelect={handleSelect}
        getId={(item) => item.id}
        renderItem={(item, isSelected) => (
          <div
            className={cn(
              "relative flex flex-col gap-3 p-4 rounded-xl border bg-card text-card-foreground shadow-sm transition-all text-left",
              "hover:shadow-md hover:bg-accent/50",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              isSelected && "ring-2 ring-primary bg-accent"
            )}
          >
            {/* Check icon - top right */}
            {isSelected && (
              <div className="absolute top-2 right-2 z-10 h-6 w-6 bg-primary rounded-full flex items-center justify-center">
                <Check className="h-3.5 w-3.5 text-primary-foreground" />
              </div>
            )}

            {/* Suggested badge - top right */}
            {isSuggested(item.id) && !isSelected && (
              <div className="absolute top-2 right-2 z-10 px-1.5 py-0.5 bg-primary/10 text-primary text-xs rounded">
                Suggested
              </div>
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
        )}
        emptyMessage="No tools found."
        disabled={disabled}
      />
    </div>
  );
}
