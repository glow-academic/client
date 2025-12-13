/**
 * ParameterItemSection.tsx
 * Reusable parameter item (field) selection section component for individual parameters
 */
"use client";
import {
  ArrowRight,
  Check,
  Loader2,
  RotateCcw,
  Shuffle,
} from "lucide-react";

import { RangeSlider } from "@/components/common/forms/RangeSlider";
import { ParameterSelector } from "@/components/parameters/ParameterSelector";
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
import { cn } from "@/lib/utils";

type StepStatus = "pending" | "active" | "completed";

export interface ParameterMappingItem {
  name: string;
  description: string;
  numerical: boolean;
  document_parameter: boolean;
  persona_parameter: boolean;
}

export interface FieldMappingItem {
  name: string;
  description: string;
  parameter_id: string;
  parameter_name: string;
}

export interface ParameterItemSectionProps {
  // Data
  parameterId: string;
  parameter: ParameterMappingItem;
  validFieldIds: string[];
  fieldMapping: Record<string, FieldMappingItem>;
  selectedFieldIds: string[];

  // State
  minMax: { min: number; max: number }; // Current values
  allowedRange?: { min: number; max: number } | undefined; // Allowed limits (optional, defaults to minMax if not provided)

  // Callbacks
  onFieldIdsChange: (ids: string[]) => void;
  onMinMaxChange: (minMax: { min: number; max: number }) => void;
  onRandomize: () => void;
  onReset: () => void;

  // UI State
  stepStatus: StepStatus;
  stepNumber: number;
  isReadonly: boolean;
  disabled?: boolean;
  isEditMode?: boolean;
  isRandomizing?: boolean;
}

export function ParameterItemSection({
  parameterId,
  parameter,
  validFieldIds,
  fieldMapping,
  selectedFieldIds,
  minMax,
  allowedRange,
  onFieldIdsChange,
  onMinMaxChange,
  onRandomize,
  onReset,
  stepStatus,
  stepNumber,
  isReadonly,
  disabled = false,
  isEditMode = false,
  isRandomizing = false,
}: ParameterItemSectionProps) {
  // Use allowedRange for slider limits, minMax for current values
  const sliderMin = allowedRange?.min ?? minMax.min ?? 1;
  const sliderMax = allowedRange?.max ?? minMax.max ?? 3;
  return (
    <Card
      className={cn(
        "transition-all",
        !isEditMode && stepStatus === "active" && "ring-2 ring-primary",
        !isEditMode && stepStatus === "pending" && "opacity-50"
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
                  : "bg-muted"
            )}
          >
            {stepStatus === "completed" ? (
              <Check className="w-4 h-4" />
            ) : (
              String(stepNumber)
            )}
          </div>
          <div className="flex-1">
            <CardTitle className="text-lg">{parameter.name}</CardTitle>
            <CardDescription>{parameter.description || ""}</CardDescription>
          </div>
        </div>
        <div className="flex items-center gap-2">
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
                    <>
                      Randomize
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </>
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
        </div>
      </CardHeader>
      <CardContent className="px-6">
        <div className="[&_label.text-sm.font-medium]:hidden">
          <ParameterSelector
            parameterMapping={{
              [parameterId]: {
                name: parameter.name,
                description: parameter.description || "",
                numerical: false,
                document_parameter: false,
                persona_parameter: false,
              },
            }}
            fieldMapping={Object.fromEntries(
              Object.entries(fieldMapping).map(([id, field]) => [
                id,
                {
                  name: field.name,
                  description: field.description || "",
                  parameter_id: field.parameter_id,
                  parameter_name: field.parameter_name || "",
                },
              ])
            )}
            validParameterItemIds={validFieldIds}
            selectedParameterItemIds={selectedFieldIds}
            onParameterItemIdsChange={onFieldIdsChange}
            disabled={isReadonly || disabled}
          />
        </div>
      </CardContent>
    </Card>
  );
}
