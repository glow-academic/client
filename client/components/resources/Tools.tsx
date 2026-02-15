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
import { useResourceAi } from "@/hooks/use-resource-ai";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { Check, Loader2, Sparkles, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef } from "react";

type CreateDraftToolsIn = InputOf<"/api/v4/resources/tools", "post">;
type CreateDraftToolsOut = OutputOf<"/api/v4/resources/tools", "post">;

// Derive resource item type from the GET endpoint response
type ToolGetResponse = OutputOf<"/api/v4/resources/tools/get", "post">;
export type ToolResourceItem = NonNullable<ToolGetResponse["items"]>[number];

export interface ToolsItem {
  id: string;
  name: string;
  description?: string;
}

export interface ToolsProps {
  tool_ids?: string[]; // Current tools resource IDs (standardized prop name)
  tool_resources?: ToolResourceItem[]; // Selected tools resources
  show_tools?: boolean; // Whether to show this resource picker
  tool_suggestions?: string[]; // Array of suggested resource IDs (UUIDs)
  tools?: ToolResourceItem[]; // All available tools from API
  disabled?: boolean; // Based on can_edit flag
  onChange: (ids: string[]) => void; // Update tool_ids in form state
  label?: string;
  id?: string;
  required?: boolean;
  placeholder?: string;
  description?: string;
  group_id?: string | null; // Group ID for linking resources
  onGenerate?: () => void | Promise<void>;
  showAiGenerate?: boolean; // Whether to show AI generate button (computed server-side)
  isGenerating?: boolean;
  searchTerm?: string; // Search term for filtering tools
  onSearchChange?: (term: string) => void; // Callback when search term changes
  showSelectedFilter?: boolean; // Whether to show only selected tools
  onShowSelectedChange?: (value: boolean) => void; // Callback when show selected filter changes
  // AI diff view props
  aiToolResources?: Pick<ToolResourceItem, "id" | "name">[] | null;
  onAccept?: () => void;
  onReject?: () => void;
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
  group_id,
  onGenerate,
  showAiGenerate = false,
  isGenerating: _isGenerating = false,
  searchTerm = "",
  onSearchChange,
  showSelectedFilter = false,
  onShowSelectedChange,
  // AI diff view props (deprecated — kept for interface compat)
  aiToolResources: _aiToolResources,
  onAccept: _onAccept,
  onReject: _onReject,
}: ToolsProps) {
  const ids = useMemo(() => tool_ids ?? [], [tool_ids]);
  const show = show_tools ?? false;
  const allTools = useMemo(() => tools ?? [], [tools]);

  // Socket-based AI suggestion handling via shared hook
  const { isGenerating: aiIsGenerating, aiSuggestions, accept: acceptAi, reject: rejectAi } = useResourceAi<
    Pick<ToolResourceItem, "id" | "name">
  >({
    resourceType: "tools",
    groupId: group_id,
    extractSuggestion: (data) => {
      const id = data["id"] as string | null | undefined;
      const name = data["name"] as string | null | undefined;
      if (!id) return null;
      return { id, name: name ?? null };
    },
    accumulate: true,
  });

  // AI suggestion state
  const showDiff = aiSuggestions.length > 0;
  const aiSuggestedIds = useMemo(
    () =>
      new Set(
        aiSuggestions
          .map((t) => t.id)
          .filter(Boolean) as string[]
      ),
    [aiSuggestions]
  );

  // Accept AI suggestion - add AI-suggested tools to selection
  const handleAccept = useCallback(() => {
    if (aiSuggestions.length === 0) return;
    const newIds = aiSuggestions
      .map((t) => t.id)
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

  const hasGenerated = useMemo(() => {
    return tool_resources?.some((t) => t.generated) ?? false;
  }, [tool_resources]);

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
      <SelectableGrid<ToolsItem>
        horizontal
        items={displayTools}
        selectedId={null}
        selectedIds={ids}
        onSelect={handleSelect}
        getId={(item) => item.id}
        renderItem={(item, isSelected) => {
          const isAiSuggested = showDiff && aiSuggestedIds.has(item.id);

          return (
            <div
              className={cn(
                "relative flex flex-col gap-3 p-4 rounded-xl border bg-card text-card-foreground shadow-sm transition-all text-left",
                "hover:shadow-md hover:bg-accent/50",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                isSelected && "ring-2 ring-primary bg-accent",
                isAiSuggested && !isSelected && "ring-2 ring-success bg-success/10"
              )}
            >
              {/* Check icon - top right */}
              {isSelected && (
                <div className="absolute top-2 right-2 z-10 h-6 w-6 bg-primary rounded-full flex items-center justify-center">
                  <Check className="h-3.5 w-3.5 text-primary-foreground" />
                </div>
              )}

              {/* AI Suggested badge - top right */}
              {isAiSuggested && !isSelected && (
                <div className="absolute top-2 right-2 z-10 px-1.5 py-0.5 bg-success/20 text-success text-[10px] rounded font-medium">
                  AI Suggested
                </div>
              )}

              {/* Suggested badge - top right */}
              {isSuggested(item.id) && !isSelected && !isAiSuggested && (
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
          );
        }}
        emptyMessage="No tools found."
        disabled={disabled}
      />
    </div>
  );
}
