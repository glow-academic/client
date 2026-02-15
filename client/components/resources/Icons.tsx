/**
 * Icons.tsx
 * Resource component for icon picker fields
 * Uses SelectableGrid to display icons as horizontal scrollable cards
 * Manages icon_id and reports to parent (pre-defined icons, no resource creation needed)
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
import type { OutputOf } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { ICON_MAP } from "@/utils/icons";
import { useResourceAi } from "@/hooks/use-resource-ai";
import { Check, Loader2, Sparkles, X } from "lucide-react";
import { useCallback, useMemo } from "react";

// Derive resource item type from the GET endpoint response
type IconGetResponse = OutputOf<"/api/v4/resources/icons/get", "post">;
export type IconResourceItem = NonNullable<IconGetResponse["items"]>[number];

export interface IconItem {
  id: string;
  name: string;
  value: string;
  description?: string;
}

export interface IconsProps {
  icon_id?: string | null; // Current icon_id (standardized prop name)
  icon_resource?: IconResourceItem | null; // Resource data from server (standardized prop name; includes generated field)
  show_icon?: boolean; // Whether to show this resource picker
  icon_suggestions?: string[]; // Array of suggested resource IDs (UUIDs)
  icons?: IconResourceItem[]; // All available icons from API (each includes generated field)
  disabled?: boolean; // Based on can_edit flag
  onIconIdChange: (iconId: string | null) => void; // Update icon_id in parent form state
  label?: string;
  id?: string;
  required?: boolean;
  searchTerm?: string;
  onSearchChange?: (term: string) => void; // Callback when search term changes
  showSelectedFilter?: boolean; // Whether to filter to show only selected
  onShowSelectedChange?: (value: boolean) => void; // Callback when show selected filter changes
  group_id?: string | null; // Group ID for linking resources
  showAiGenerate?: boolean; // Whether to show AI generate button (computed server-side)
  onGenerate?: () => void | Promise<void>;
  isGenerating?: boolean;
  // Legacy props for backward compatibility
  iconResource?: IconResourceItem | null;
  iconId?: string | null;
  allIcons?: string[];
  suggestedIcons?: string[];
  iconSuggestions?: string[];
  // AI diff view props
  aiResource?: Pick<IconResourceItem, "id" | "name" | "value"> | null | undefined;
  onAccept?: () => void;
  onReject?: () => void;
  onGenerationComplete?: () => void;
}

export function Icons({
  icon_id,
  icon_resource,
  show_icon = false,
  icon_suggestions,
  icons,
  disabled = false,
  onIconIdChange,
  label = "Icon",
  id = "icon",
  required = false,
  searchTerm = "",
  onSearchChange,
  showSelectedFilter = false,
  onShowSelectedChange,
  group_id,
  showAiGenerate = false,
  onGenerate,
  isGenerating = false,
  // Legacy props for backward compatibility
  iconResource,
  iconId: _iconId,
  allIcons,
  suggestedIcons = [],
  iconSuggestions,
  // AI diff view props
  aiResource,
  onAccept,
  onReject,
  onGenerationComplete,
}: IconsProps) {
  // Use standardized props with fallback to legacy props
  const resource = icon_resource ?? iconResource ?? null;
  const currentId = icon_id ?? _iconId ?? null;
  const show = show_icon ?? false;
  const suggestionsList = useMemo(
    () => icon_suggestions ?? iconSuggestions ?? [],
    [icon_suggestions, iconSuggestions]
  );
  const allIconsArray = useMemo(() => icons ?? [], [icons]);

  // Socket-based AI suggestion handling via shared hook
  const { isGenerating: aiIsGenerating, aiSuggestion, accept: acceptAi, reject: rejectAi } = useResourceAi<{
    id: string | null;
    name: string | null;
    value: string;
  }>({
    resourceType: "icons",
    groupId: group_id,
    extractSuggestion: (data) => {
      if (!data.success && data.success !== undefined) return null;
      return {
        id: (data.id as string) ?? null,
        name: (data.name as string) ?? null,
        value: (data.value as string) ?? "",
      };
    },
  });

  // AI suggestion state
  const showDiff = !!aiSuggestion?.id;
  const aiSuggestedId = aiSuggestion?.id || null;

  // Accept AI suggestion - update icon selection
  const handleAccept = useCallback(() => {
    if (!aiSuggestion?.id) return;
    onIconIdChange(aiSuggestion.id);
    acceptAi();
  }, [aiSuggestion, onIconIdChange, acceptAi]);

  // Reject AI suggestion - just clear the pending state
  const handleReject = useCallback(() => {
    rejectAi();
  }, [rejectAi]);

  // Convert icons array to IconItem format for SelectableGrid
  const iconItems = useMemo(() => {
    if (allIconsArray.length > 0) {
      return allIconsArray
        .filter((i) => i.id && i.value) // Filter out nulls
        .map((i) => ({
          id: i.id!,
          name: i.name ?? i.value!,
          value: i.value!,
          ...(i.description ? { description: i.description } : {}),
        }));
    }
    // Fallback for legacy allIcons prop (array of icon names/values)
    if (allIcons && allIcons.length > 0) {
      return allIcons.map((iconName) => ({
        id: iconName,
        name: iconName,
        value: iconName,
      }));
    }
    return [];
  }, [allIconsArray, allIcons]);

  // Get suggested icon IDs
  const suggestedIconIds = useMemo(() => {
    if (suggestionsList.length > 0) {
      return new Set(suggestionsList);
    }
    // Legacy: suggestedIcons are icon values, need to map to IDs
    if (suggestedIcons.length > 0 && iconItems.length > 0) {
      const ids = new Set<string>();
      suggestedIcons.forEach((iconValue) => {
        const item = iconItems.find((i) => i.value === iconValue);
        if (item) ids.add(item.id);
      });
      return ids;
    }
    return new Set<string>();
  }, [suggestionsList, suggestedIcons, iconItems]);

  // Check if an icon is suggested
  const isSuggested = useCallback(
    (iconId: string) => suggestedIconIds.has(iconId),
    [suggestedIconIds]
  );

  // Filter icons based on search term and showSelectedFilter
  const displayIcons = useMemo(() => {
    let filtered = iconItems;

    // Filter to show only selected if showSelectedFilter is true
    if (showSelectedFilter && currentId) {
      filtered = filtered.filter((item) => item.id === currentId);
    }

    // Filter by search term
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (item) =>
          item.name.toLowerCase().includes(searchLower) ||
          item.value.toLowerCase().includes(searchLower)
      );
    }

    return filtered;
  }, [iconItems, searchTerm, showSelectedFilter, currentId]);

  // Handle icon selection - just update parent state directly
  const handleSelect = useCallback(
    (iconId: string) => {
      // Toggle selection (single-select)
      const newId = iconId === currentId ? null : iconId;
      onIconIdChange(newId);
    },
    [currentId, onIconIdChange]
  );

  // Check if any icon resource is generated
  const hasGenerated = useMemo(() => {
    return resource?.generated ?? false;
  }, [resource]);

  // Don't render if show_icon is false (AFTER all hooks)
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

      <SelectableGrid<IconItem>
        items={displayIcons}
        selectedId={currentId}
        onSelect={(iconId) => handleSelect(iconId)}
        getId={(item) => item.id}
        renderItem={(item, isSelected) => {
          const IconComponent =
            ICON_MAP[item.value as keyof typeof ICON_MAP];
          if (!IconComponent) return null;

          const isAiSuggested = showDiff && item.id === aiSuggestedId;

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

              <div className="flex flex-col items-center justify-center gap-1 flex-1 overflow-hidden">
                <IconComponent className="h-7 w-7 text-foreground shrink-0" />
                <span className="text-xs font-medium text-center truncate w-full">
                  {item.name}
                </span>
              </div>
            </div>
          );
        }}
        emptyMessage="No icons found. Try adjusting your search."
        disabled={disabled}
        horizontal
      />
    </div>
  );
}
