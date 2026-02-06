/**
 * TemperatureLevels.tsx
 * Resource component for temperature level selection
 * Uses GenericPicker for selection, optionally displays slider for visual feedback
 * Creates resources independently and reports resource IDs to parent
 */

"use client";

import { GenericPicker } from "@/components/common/forms/GenericPicker";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Check, Loader2, Sparkles, X } from "lucide-react";
import { useCallback, useMemo } from "react";

export interface TemperatureLevelItem {
  id: string;
  temperature: string;
  is_upper: boolean;
}

export interface TemperatureLevelsProps {
  temperature_level_id?: string | null; // Current temperature_level_id (standardized prop name)
  temperature_level_resource?: {
    id: string | null;
    temperature: string | null;
    is_upper?: boolean | null;
    generated?: boolean | null;
  } | null; // Resource data from server (standardized prop name; includes generated field)
  show_temperature_levels?: boolean; // Whether to show this resource picker
  temperature_level_suggestions?: string[]; // Array of suggested resource IDs (UUIDs)
  temperature_levels?: Array<{
    id: string | null;
    temperature: string | null;
    is_upper?: boolean | null;
    generated?: boolean | null;
  }>; // Array of all available temperature level options
  temperature_lower?: number | null; // Lower bound for slider (optional)
  temperature_upper?: number | null; // Upper bound for slider (optional)
  disabled?: boolean; // Based on can_edit flag
  onTemperatureLevelIdChange: (
    temperatureLevelId: string | null
  ) => void; // Update temperature_level_id in parent form state
  onGenerate?: () => Promise<void>;
  isGenerating?: boolean;
  label?: string;
  placeholder?: string;
  required?: boolean;
  id?: string;
  "data-testid"?: string;
  helpText?: string;
  searchTerm?: string;
  onSearchChange?: (term: string) => void;
  showSlider?: boolean; // Whether to show slider for visual feedback
  group_id?: string | null; // Group ID for linking resources
  link_tool_id?: string | null; // Tool ID for AI link suggestions
  // AI diff view props
  aiTemperatureLevelResources?: Array<{
    temperature_level_id?: string | null;
    name?: string | null;
  }> | null;
  onAccept?: () => void;
  onReject?: () => void;
}

export function TemperatureLevels({
  temperature_level_id,
  temperature_level_resource,
  show_temperature_levels = true,
  temperature_level_suggestions,
  temperature_levels,
  temperature_lower,
  temperature_upper,
  disabled = false,
  onTemperatureLevelIdChange,
  onGenerate,
  isGenerating = false,
  label = "Temperature Level",
  placeholder = "Select a temperature level",
  required = false,
  id = "temperature_level",
  "data-testid": dataTestId,
  helpText,
  searchTerm,
  onSearchChange,
  showSlider = false,
  group_id,
  link_tool_id,
  // AI diff view props
  aiTemperatureLevelResources,
  onAccept,
  onReject,
}: TemperatureLevelsProps) {
  const resource = temperature_level_resource ?? null;
  const resourceId = temperature_level_id ?? null;
  const show = show_temperature_levels ?? true;

  // AI suggestion state
  const showDiff = !!aiTemperatureLevelResources?.length;
  const _aiSuggestedIds = useMemo(
    () =>
      new Set(
        aiTemperatureLevelResources
          ?.map((t) => t.temperature_level_id)
          .filter(Boolean) as string[]
      ),
    [aiTemperatureLevelResources]
  );
  // Note: _aiSuggestedIds available for future use in highlighting suggested items

  // Accept AI suggestion - select AI-suggested temperature level
  const handleAccept = useCallback(() => {
    if (!aiTemperatureLevelResources?.length) return;
    const firstSuggested = aiTemperatureLevelResources[0]?.temperature_level_id;
    if (firstSuggested) {
      onTemperatureLevelIdChange(firstSuggested);
    }
    onAccept?.();
  }, [aiTemperatureLevelResources, onTemperatureLevelIdChange, onAccept]);

  // Reject AI suggestion - just clear the pending state
  const handleReject = useCallback(() => {
    onReject?.();
  }, [onReject]);

  const _suggestionsList = useMemo(
    () => temperature_level_suggestions ?? [],
    [temperature_level_suggestions]
  );
  // Note: _suggestionsList available for future use
  const filteredTemperatureLevels = useMemo(() => {
    if (!searchTerm?.trim()) {
      return temperature_levels ?? [];
    }
    const term = searchTerm.toLowerCase();
    return (temperature_levels ?? []).filter((tl) => {
      const value = tl.temperature?.toLowerCase() ?? "";
      return value.includes(term);
    });
  }, [temperature_levels, searchTerm]);

  // Convert temperature_levels array to TemperatureLevelItem format for GenericPicker
  // Only include lower bounds (is_upper = false) for selection
  const pickerItems = useMemo(() => {
    if (filteredTemperatureLevels.length > 0) {
      return filteredTemperatureLevels
        .filter(
          (tl) => tl.id && tl.temperature && tl.is_upper === false
        ) // Filter out nulls and upper bounds
        .map((tl) => ({
          id: tl.id!,
          temperature: tl.temperature!,
          is_upper: false,
        }));
    }
    return [];
  }, [filteredTemperatureLevels]);

  // Get current temperature value from selected level
  const currentTemperature = useMemo(() => {
    if (!resourceId || !temperature_levels) return null;
    const selectedLevel = temperature_levels.find((tl) => tl.id === resourceId);
    if (selectedLevel && selectedLevel.temperature) {
      return parseFloat(selectedLevel.temperature);
    }
    return null;
  }, [resourceId, temperature_levels]);

  // Helper to get temperature level ID from temperature value
  const getTemperatureLevelId = useMemo(() => {
    return (temp: number): string | null => {
      if (!temperature_levels) return null;
      const matchingLevel = temperature_levels.find(
        (l) =>
          !l.is_upper &&
          l.temperature &&
          Math.abs(parseFloat(l.temperature) - temp) < 0.01
      );
      return matchingLevel?.id || null;
    };
  }, [temperature_levels]);

  // Don't render if show_temperature_levels is false (AFTER all hooks)
  if (!show) {
    return null;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-end justify-between">
        <div className="flex items-center gap-2">
          <Label htmlFor={id} className="flex items-center gap-1">
            {label}
            {required && <span className="text-destructive">*</span>}
          </Label>
          {onGenerate && link_tool_id && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={onGenerate}
                    disabled={disabled || isGenerating || showDiff}
                  >
                    {isGenerating ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {resource?.generated ? "Regenerate" : "Generate"}
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
      </div>

      {/* Slider for visual feedback (optional) */}
      {showSlider &&
        temperature_lower !== null &&
        temperature_upper !== null &&
        currentTemperature !== null && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>{temperature_lower}</span>
              <span className="font-medium">{currentTemperature.toFixed(2)}</span>
              <span>{temperature_upper}</span>
            </div>
            <Slider
              value={[currentTemperature]}
              min={temperature_lower}
              max={temperature_upper}
              step={0.01}
              disabled={disabled}
              onValueChange={(value) => {
                const tempValue = value[0];
                const levelId = getTemperatureLevelId(tempValue);
                onTemperatureLevelIdChange(levelId);
              }}
              className="w-full"
              data-testid={`${dataTestId}-slider`}
            />
          </div>
        )}

      <GenericPicker<TemperatureLevelItem>
        items={pickerItems}
        selectedIds={resourceId ? [resourceId] : []}
        onSelect={(ids) => onTemperatureLevelIdChange(ids[0] || null)}
        multiSelect={false}
        getId={(item) => item.id}
        getLabel={(item) => `${item.temperature}`}
        getSearchText={(item) => item.temperature}
        renderPreview={(item) => (
          <div className="space-y-1">
            <div className="font-medium">Temperature: {item.temperature}</div>
          </div>
        )}
        {...(searchTerm !== undefined ? { initialSearchTerm: searchTerm } : {})}
        {...(onSearchChange ? { onSearchChange } : {})}
        placeholder={placeholder}
        disabled={disabled}
        showLabel={false}
        label={label}
        description={helpText}
        emptyMessage="No temperature levels available"
        groupHeading="Temperature Levels"
        id={id}
        data-testid={dataTestId}
      />
    </div>
  );
}
