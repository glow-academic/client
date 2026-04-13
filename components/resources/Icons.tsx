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
import { cn } from "@/lib/utils";
import { ICON_MAP } from "@/utils/icons";
import { useResourceAi } from "@/hooks/use-resource-ai";
import { Check, Loader2, Sparkles, X } from "lucide-react";
import { useCallback, useMemo } from "react";

export interface IconResourceItem {
  id?: string | null;
  name?: string | null;
  value?: string | null;
  description?: string | null;
  generated?: boolean | null;
  suggested?: boolean | null;
  pending?: boolean | null;
}

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
  icons?: IconResourceItem[]; // All available icons from API (each includes generated and suggested fields)
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
  /** When false, skip automatic link tracking (manual save mode) */
  isAutosaveEnabled?: boolean;
  // Legacy props for backward compatibility
  iconResource?: IconResourceItem | null;
  iconId?: string | null;
  allIcons?: string[];
}

export function Icons({
  icon_id,
  icon_resource,
  show_icon = false,
  icons,
  disabled = false,
  onIconIdChange,
  label = "Icon",
  id = "icon",
  required = false,
  searchTerm = "",
  onSearchChange: _onSearchChange,
  showSelectedFilter = false,
  onShowSelectedChange: _onShowSelectedChange,
  group_id,
  showAiGenerate = false,
  onGenerate,
  _isAutosaveEnabled = true,
  // Legacy props for backward compatibility
  iconResource,
  iconId: _iconId,
  allIcons,
}: IconsProps) {
  // Use standardized props with fallback to legacy props
  const resource = icon_resource ?? iconResource ?? null;
  const currentId = icon_id ?? _iconId ?? null;
  const show = show_icon ?? false;
  const allIconsArray = useMemo(() => icons ?? [], [icons]);

  // Socket-based AI suggestion handling via shared hook
  const { isGenerating: aiIsGenerating, aiSuggestion, clear: clearAi } = useResourceAi({
    resourceType: "icons",
    groupId: group_id,
  });

  // AI suggestion state
  const showDiff = !!aiSuggestion?.id;
  const aiSuggestedId = aiSuggestion?.id || null;

  // Accept AI suggestion - update icon selection
  const handleAccept = useCallback(() => {
    if (!aiSuggestion?.id) return;
    onIconIdChange(aiSuggestion.id);
    clearAi();
  }, [aiSuggestion, onIconIdChange, clearAi]);

  // Reject AI suggestion - just clear the pending state
  const handleReject = useCallback(() => {
    clearAi();
  }, [clearAi]);

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

  // Detect pending items
  const hasPending = useMemo(() => {
    return allIconsArray?.some((item) => item.pending) ?? false;
  }, [allIconsArray]);

  // Check if an icon is pending
  const isPendingIcon = useCallback(
    (iconId: string) => {
      const icon = allIconsArray.find((i) => i.id === iconId);
      return icon?.pending === true;
    },
    [allIconsArray]
  );

  // Check if an icon is suggested (derived from item.suggested field)
  const isSuggested = useCallback(
    (iconId: string) => {
      const icon = allIconsArray.find((i) => i.id === iconId);
      return icon?.suggested === true;
    },
    [allIconsArray]
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
          const isPending = isPendingIcon(item.id);

          return (
            <div
              className={cn(
                "relative flex flex-col p-3 rounded-xl border bg-card text-card-foreground shadow-sm transition-all text-left h-[88px]",
                "hover:shadow-md hover:bg-accent/50",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                isSelected && "ring-2 ring-primary bg-accent",
                isAiSuggested && !isSelected && "ring-2 ring-success bg-success/10",
                isPending && !isSelected && "ring-2 ring-amber-500 bg-amber-50"
              )}
            >
              {/* Check icon - top right */}
              {isSelected && (
                <div className="absolute top-2 right-2 z-10 h-5 w-5 bg-primary rounded-full flex items-center justify-center">
                  <Check className="h-3 w-3 text-primary-foreground" />
                </div>
              )}

              {/* Pending badge - top right */}
              {isPending && !isSelected && (
                <div className="absolute top-2 right-2 z-10 px-1.5 py-0.5 bg-amber-500/20 text-amber-600 text-[10px] rounded font-medium">
                  Pending
                </div>
              )}

              {/* AI suggested badge - top right */}
              {isAiSuggested && !isSelected && !isPending && (
                <div className="absolute top-2 right-2 z-10 px-1.5 py-0.5 bg-success/20 text-success text-[10px] rounded font-medium">
                  AI Suggested
                </div>
              )}

              {/* Suggested dot indicator - top right */}
              {isSuggested(item.id) && !isSelected && !isAiSuggested && !isPending && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="absolute top-2 right-2 z-10 h-1.5 w-1.5 rounded-full bg-primary" />
                    </TooltipTrigger>
                    <TooltipContent side="top">Suggested</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
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
