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
import type { InputOf, OutputOf } from "@/lib/api/types";
import { Loader2, Sparkles } from "lucide-react";
import { useMemo } from "react";

type CreateDraftTemperatureLevelsIn = InputOf<
  "/api/v4/resources/temperature_levels",
  "post"
>;
type CreateDraftTemperatureLevelsOut = OutputOf<
  "/api/v4/resources/temperature_levels",
  "post"
>;

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
  showSlider?: boolean; // Whether to show slider for visual feedback
  group_id?: string | null; // Group ID for linking resources
  agent_id?: string | null; // Agent ID for resource creation
  createTemperatureLevelsAction?:
    | ((
        input: CreateDraftTemperatureLevelsIn
      ) => Promise<CreateDraftTemperatureLevelsOut>)
    | undefined;
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
  showSlider = false,
  group_id,
  agent_id,
  createTemperatureLevelsAction,
}: TemperatureLevelsProps) {
  const resource = temperature_level_resource ?? null;
  const resourceId = temperature_level_id ?? null;
  const show = show_temperature_levels ?? true;
  const suggestionsList = useMemo(
    () => temperature_level_suggestions ?? [],
    [temperature_level_suggestions]
  );

  // Convert temperature_levels array to TemperatureLevelItem format for GenericPicker
  // Only include lower bounds (is_upper = false) for selection
  const pickerItems = useMemo(() => {
    if (temperature_levels && temperature_levels.length > 0) {
      return temperature_levels
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
  }, [temperature_levels]);

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
                  {resource?.generated ? "Regenerate" : "Generate"}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
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
