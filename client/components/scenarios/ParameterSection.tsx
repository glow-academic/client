/**
 * ParameterSection.tsx
 * Reusable parameter selection section component
 */
"use client";
import { Check, Filter, Loader2, RotateCcw, Search, Shuffle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { RangeSlider } from "@/components/common/forms/RangeSlider";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

type StepStatus = "pending" | "active" | "completed";

export interface ParameterMappingItem {
  name: string;
  description?: string;
}

export interface ParameterSectionProps {
  // Data
  validParameterIds: string[];
  parameterMapping: Record<string, ParameterMappingItem>;
  selectedParameterIds: string[];

  // State
  searchTerm: string;
  minMax: { min: number; max: number }; // Current values
  allowedRange?: { min: number; max: number } | undefined; // Allowed limits (optional, defaults to minMax if not provided)
  showSelected?: boolean; // Filter value from URL (read-only, server handles filtering)

  // Callbacks
  onParameterIdsChange: (ids: string[]) => void;
  onSearchTermChange: (term: string) => void;
  onMinMaxChange: (minMax: { min: number; max: number }) => void;
  onRandomize: () => void;
  onReset: () => void;
  onParameterUnselect?: (paramId: string) => void; // Optional callback for cleanup when unselecting
  onShowSelectedChange?: (value: boolean) => void; // Callback to update URL params

  // UI State
  stepStatus: StepStatus;
  stepTitle: string;
  stepDescription: string;
  stepNumber: number;
  isReadonly: boolean;
  disabled?: boolean;
  isEditMode?: boolean;
  isRandomizing?: boolean;
}

export function ParameterSection({
  validParameterIds,
  parameterMapping,
  selectedParameterIds,
  searchTerm,
  minMax,
  allowedRange,
  showSelected = false,
  onParameterIdsChange,
  onSearchTermChange,
  onMinMaxChange,
  onRandomize,
  onReset,
  onParameterUnselect,
  onShowSelectedChange,
  stepStatus,
  stepTitle,
  stepDescription,
  stepNumber,
  isReadonly,
  disabled = false,
  isEditMode = false,
  isRandomizing = false,
}: ParameterSectionProps) {
  // Use allowedRange for slider limits, minMax for current values
  const sliderMin = allowedRange?.min ?? minMax.min ?? 0;
  const sliderMax = allowedRange?.max ?? minMax.max ?? 3;

  // Local temporary state for filter values (until Apply is clicked)
  const [tempShowSelected, setTempShowSelected] = useState<boolean>(showSelected);
  const [filterPopoverOpen, setFilterPopoverOpen] = useState<boolean>(false);

  // Sync temporary state when props change
  useEffect(() => {
    setTempShowSelected(showSelected);
  }, [showSelected]);

  // Server handles filtering via validParameterIds (showSelected filter applied server-side)
  // Client only applies search term filtering (for instant feedback while typing)
  const filteredParameterIds = useMemo(() => {
    if (!searchTerm.trim()) {
      return validParameterIds; // Server already filtered, just return as-is
    }
    const searchLower = searchTerm.toLowerCase();
    return validParameterIds.filter((paramId) => {
      const param = parameterMapping[paramId];
      if (!param) return false;
      const searchText =
        `${param.name} ${param.description || ""}`.toLowerCase();
      return searchText.includes(searchLower);
    });
  }, [validParameterIds, parameterMapping, searchTerm]);

  const handleApplyFilters = () => {
    onShowSelectedChange?.(tempShowSelected);
    setFilterPopoverOpen(false);
  };

  if (validParameterIds.length === 0) {
    return null;
  }

  return (
    <Card
      className={cn(
        "transition-all",
        !isEditMode && stepStatus === "active" && "ring-2 ring-primary",
        !isEditMode && stepStatus === "pending" && "opacity-50",
      )}
    >
      <CardHeader className="flex flex-row items-center space-y-0 pb-2 justify-between">
        <div className="flex items-center space-x-3">
          <div
            className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium",
              stepStatus === "completed"
                ? "bg-green-500 text-white"
                : stepStatus === "active"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted",
            )}
          >
            {stepStatus === "completed" ? (
              <Check className="w-4 h-4" />
            ) : (
              String(stepNumber)
            )}
          </div>
          <div className="flex-1">
            <CardTitle className="text-lg">{stepTitle}</CardTitle>
            <CardDescription>{stepDescription}</CardDescription>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {validParameterIds.length > 0 && (
            <>
              <Popover>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <PopoverTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={isReadonly || disabled || isRandomizing}
                      >
                        {isRandomizing ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Shuffle className="h-4 w-4" />
                        )}
                      </Button>
                    </PopoverTrigger>
                  </TooltipTrigger>
                  <TooltipContent>Randomize</TooltipContent>
                </Tooltip>
                <PopoverContent className="w-80 p-4" align="end">
                  <div className="space-y-4">
                    <RangeSlider
                      min={sliderMin}
                      max={sliderMax}
                      value={[minMax.min ?? sliderMin, minMax.max ?? sliderMax]}
                      onValueChange={([min, max]) =>
                        onMinMaxChange({
                          min: min ?? sliderMin,
                          max: max ?? sliderMax,
                        })
                      }
                      disabled={isReadonly || disabled}
                      label="Range"
                    />
                    <Button
                      onClick={onRandomize}
                      disabled={isReadonly || disabled || isRandomizing}
                      className="w-full"
                      size="sm"
                    >
                      {isRandomizing ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Randomizing...
                        </>
                      ) : (
                        "Randomize"
                      )}
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={onReset}
                    disabled={isReadonly || disabled}
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Reset</TooltipContent>
              </Tooltip>
            </>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3 px-6">
        {/* Search bar */}
        <div className="flex h-9 items-center gap-2 border-b px-0">
          <Search className="size-4 shrink-0 opacity-50" />
          <input
            type="text"
            placeholder="Search parameters..."
            value={searchTerm}
            onChange={(e) => onSearchTermChange(e.target.value)}
            className="placeholder:text-muted-foreground flex h-9 w-full bg-transparent py-2 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isReadonly || disabled}
          />
          <Popover open={filterPopoverOpen} onOpenChange={setFilterPopoverOpen}>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={isReadonly || disabled}
                    className="relative"
                  >
                    <Filter className="h-4 w-4" />
                    {showSelected && (
                      <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-primary" />
                    )}
                  </Button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent>Filters</TooltipContent>
            </Tooltip>
            <PopoverContent className="w-64 p-4" align="end">
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="parameter-show-selected"
                      checked={tempShowSelected}
                      onCheckedChange={(checked) =>
                        setTempShowSelected(checked === true)
                      }
                      disabled={isReadonly || disabled}
                    />
                    <label
                      htmlFor="parameter-show-selected"
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      Show selected
                    </label>
                  </div>
                </div>
                <Button
                  onClick={handleApplyFilters}
                  disabled={isReadonly || disabled}
                  className="w-full"
                  size="sm"
                >
                  Apply
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* Filtered parameters grid */}
        <div className="grid grid-cols-4 gap-4 min-h-[272px] max-h-[272px] overflow-y-auto py-2 -mx-6 px-6">
          {filteredParameterIds.map((paramId) => {
            const param = parameterMapping[paramId];
            if (!param) return null;

            const isSelected = selectedParameterIds.includes(paramId);

            return (
              <button
                key={paramId}
                type="button"
                onClick={() => {
                  if (isReadonly || disabled) return;
                  const currentIds = selectedParameterIds;
                  const newIds = isSelected
                    ? currentIds.filter((id) => id !== paramId)
                    : [...currentIds, paramId];
                  onParameterIdsChange(newIds);

                  // When unselecting a parameter, call cleanup callback if provided
                  if (isSelected && onParameterUnselect) {
                    onParameterUnselect(paramId);
                  }
                }}
                disabled={isReadonly || disabled}
                className={cn(
                  "relative flex flex-col gap-3 p-4 rounded-xl border bg-card text-card-foreground shadow-sm transition-all text-left",
                  "hover:shadow-md hover:bg-accent/50",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  "disabled:pointer-events-none disabled:opacity-50",
                  isSelected && "ring-2 ring-primary bg-accent",
                )}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">{param.name}</div>
                    {param.description && (
                      <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {param.description}
                      </div>
                    )}
                  </div>
                  {isSelected && (
                    <Check className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
