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
import type { InputOf, OutputOf } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { Check, Loader2, Sparkles } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef } from "react";

type CreateDraftSettingsIn = InputOf<
  "/api/v4/resources/settings",
  "post"
>;
type CreateDraftSettingsOut = OutputOf<
  "/api/v4/resources/settings",
  "post"
>;

export interface SettingItem {
  id: string;
  name: string;
  description?: string;
}

export interface SettingsProps {
  settings_ids?: string[]; // Current settings resource IDs (standardized prop name)
  settings_resources?: Array<{
    settings_id: string | null;
    created_at?: string | null;
    active?: boolean | null;
    department_ids?: string[] | null;
    generated?: boolean | null;
  }>; // Selected settings resources (each includes generated field)
  show_settings?: boolean; // Whether to show this resource picker
  settings_suggestions?: string[]; // Array of suggested resource IDs (UUIDs)
  settings?: Array<{
    settings_id: string | null;
    created_at?: string | null;
    active?: boolean | null;
    department_ids?: string[] | null;
    generated?: boolean | null;
  }>; // All available settings from API (each includes generated field)
  disabled?: boolean; // Based on can_edit flag
  onChange: (ids: string[]) => void; // Update settings_ids in form state
  label?: string;
  id?: string;
  required?: boolean;
  placeholder?: string;
  description?: string;
  group_id?: string | null; // Group ID for linking resources
  agent_id?: string | null; // Agent ID for resource creation
  createSettingsAction?:
    | ((input: CreateDraftSettingsIn) => Promise<CreateDraftSettingsOut>)
    | undefined;
  onGenerate?: () => void | Promise<void>;
  isGenerating?: boolean;
  // Legacy props for backward compatibility
  settingsIds?: string[];
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
  agent_id,
  createSettingsAction,
  onGenerate,
  isGenerating = false,
  // Legacy props for backward compatibility
  settingsIds,
}: SettingsProps) {
  // Use standardized props with fallback to legacy props
  const ids = useMemo(
    () => settings_ids ?? settingsIds ?? [],
    [settings_ids, settingsIds]
  );
  const show = show_settings ?? false;
  const allSettings = useMemo(() => settings ?? [], [settings]);
  const suggestionsList = useMemo(
    () => settings_suggestions ?? [],
    [settings_suggestions]
  );

  // Track which settings IDs have already had resources created
  const createdSettingsIdsRef = useRef<Set<string>>(new Set());

  // Initialize createdSettingsIdsRef with current IDs
  useEffect(() => {
    ids.forEach((id) => createdSettingsIdsRef.current.add(id));
  }, [ids]);

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
    async (selectedIds: string[]) => {
      // Find newly selected IDs
      const newlySelected = selectedIds.filter(
        (id) => !ids.includes(id) && !createdSettingsIdsRef.current.has(id)
      );

      // Create resources for newly selected settings
      if (
        newlySelected.length > 0 &&
        createSettingsAction &&
        agent_id &&
        group_id
      ) {
        for (const settingId of newlySelected) {
          try {
            await createSettingsAction({
              body: {
                agent_id: agent_id,
                group_id: group_id,
                settings_id: settingId,
                mcp: false,
              },
            });
            createdSettingsIdsRef.current.add(settingId);
          } catch (error) {
            // eslint-disable-next-line no-console
            console.error(
              `Failed to create settings resource for ${settingId}:`,
              error
            );
            // Don't block UI - still update selection
          }
        }
      }

      // Update parent state
      onChange(selectedIds);
    },
    [ids, onChange, createSettingsAction, agent_id, group_id]
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
          {onGenerate && agent_id && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={onGenerate}
                    disabled={disabled || isGenerating}
                  >
                    {isGenerating ? (
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
        renderItem={(item, isSelected) => (
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {isSuggested(item.id) && !isSelected && (
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
        )}
        placeholder={placeholder}
        disabled={disabled}
        showLabel={false}
        hideSelectedChips={false}
        showClearAll={true}
      />
    </div>
  );
}
