/**
 * Settings.tsx
 * Resource component for settings selection
 * Uses GenericPicker to select existing settings resources
 * Manages settings_ids array and reports to parent
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
import { useResourceAi } from "@/hooks/use-resource-ai";
import type { OutputOf } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { Check, Loader2, Sparkles, X } from "lucide-react";
import { useCallback, useMemo } from "react";

// Derive resource item type from the GET endpoint response
type SettingGetResponse = OutputOf<"/api/v5/resources/settings/get", "post">;
export type SettingResourceItem = NonNullable<SettingGetResponse["items"]>[number];

export interface SettingItem {
  id: string;
  name: string;
  description?: string;
}

export interface SettingsProps {
  settings_ids?: string[]; // Current settings resource IDs (standardized prop name)
  settings_resources?: SettingResourceItem[]; // Selected settings resources (each includes generated field)
  show_settings?: boolean; // Whether to show this resource picker
  settings_suggestions?: string[]; // Array of suggested resource IDs (UUIDs)
  settings?: SettingResourceItem[]; // All available settings from API (each includes generated field)
  disabled?: boolean; // Based on can_edit flag
  onChange: (ids: string[]) => void; // Update settings_ids in form state
  label?: string;
  id?: string;
  required?: boolean;
  placeholder?: string;
  description?: string;
  group_id?: string | null; // Group ID for linking resources
  onGenerate?: () => void | Promise<void>;
  showAiGenerate?: boolean; // Whether to show AI generate button (computed server-side)
  // Legacy props for backward compatibility
  settingsIds?: string[];
  aiSettingsResources?: Pick<SettingResourceItem, "settings_id" | "name">[] | null;
}

export function Settings({
  settings_ids,
  settings_resources,
  show_settings = false,
  settings_suggestions,
  settings,
  disabled = false,
  onChange,
  label = "Settings",
  id = "settings",
  required = false,
  placeholder = "Select settings...",
  description,
  group_id,
  onGenerate,
  showAiGenerate = false,
  // Legacy props for backward compatibility
  settingsIds,
  aiSettingsResources: _aiSettingsResources,
}: SettingsProps) {
  // Use standardized props with fallback to legacy props
  const ids = useMemo(
    () => settings_ids ?? settingsIds ?? [],
    [settings_ids, settingsIds]
  );
  const show = show_settings ?? false;
  const allSettings = useMemo(() => settings ?? [], [settings]);

  // Socket-based AI suggestion handling via shared hook
  const { isGenerating: aiIsGenerating, aiSuggestions, clear: clearAi } = useResourceAi({
    resourceType: "settings",
    groupId: group_id,
    accumulate: true,
  });

  // AI suggestion state
  const showDiff = aiSuggestions.length > 0;
  const aiSuggestedIds = useMemo(
    () =>
      new Set(
        aiSuggestions
          .map((s) => s.settings_id)
          .filter(Boolean) as string[]
      ),
    [aiSuggestions]
  );

  // Accept AI suggestion - add AI-suggested settings to selection
  const handleAccept = useCallback(() => {
    if (aiSuggestions.length === 0) return;
    const newIds = aiSuggestions
      .map((s) => s.settings_id)
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

  const suggestionsList = useMemo(
    () => settings_suggestions ?? [],
    [settings_suggestions]
  );

  // Convert settings array to SettingItem format for GenericPicker
  const settingItems = useMemo(() => {
    return allSettings
      .filter((s) => s.settings_id && s.active) // Filter out nulls and inactive
      .map((s) => ({
        id: s.settings_id!,
        name: `Settings ${s.settings_id!.slice(0, 8)}...`,
        ...(s.department_ids && s.department_ids.length > 0
          ? { description: `${s.department_ids.length} departments` }
          : {}),
      }));
  }, [allSettings]);

  // Check if a setting is suggested
  const isSuggested = useCallback(
    (settingId: string) => suggestionsList.includes(settingId),
    [suggestionsList]
  );

  const handleSelect = useCallback(
    (selectedIds: string[]) => {
      // Update parent state
      onChange(selectedIds);
    },
    [onChange]
  );

  // Check if any settings resource is generated (must be before early return)
  const hasGenerated = useMemo(() => {
    return settings_resources?.some((s) => s.generated) ?? false;
  }, [settings_resources]);

  // Don't render if show_settings is false (AFTER all hooks)
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
      <GenericPicker<SettingItem>
        items={settingItems}
        itemIds={allSettings
          .filter((s) => s.settings_id && s.active !== false)
          .map((s) => s.settings_id!)
          .filter((id): id is string => id !== null)} // All settings IDs from array, filter nulls and inactive
        selectedIds={ids}
        onSelect={handleSelect}
        multiSelect={true}
        getId={(item) => item.id}
        getLabel={(item) => item.name}
        renderItem={(item, isSelected) => {
          const isAiSuggested = showDiff && aiSuggestedIds.has(item.id);

          return (
            <div className={cn(
              "flex items-center justify-between w-full",
              isAiSuggested && !isSelected && "ring-2 ring-success bg-success/10 rounded"
            )}>
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {isAiSuggested && !isSelected && (
                  <span className="px-1.5 py-0.5 bg-success/20 text-success text-xs rounded shrink-0">
                    AI Suggested
                  </span>
                )}
                {isSuggested(item.id) && !isSelected && !isAiSuggested && (
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
          );
        }}
        placeholder={placeholder}
        disabled={disabled}
        showLabel={false}
        hideSelectedChips={false}
        showClearAll={true}
      />
    </div>
  );
}
