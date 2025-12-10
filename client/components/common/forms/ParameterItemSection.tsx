/**
 * ParameterItemSection.tsx
 * Reusable parameter item (field) selection section component for individual parameters
 */
"use client";
import { Check, RotateCcw, Shuffle } from "lucide-react";

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
  minMax: { min: number; max: number };

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
}

export function ParameterItemSection({
  parameterId,
  parameter,
  validFieldIds,
  fieldMapping,
  selectedFieldIds,
  minMax,
  onFieldIdsChange,
  onMinMaxChange,
  onRandomize,
  onReset,
  stepStatus,
  stepNumber,
  isReadonly,
  disabled = false,
  isEditMode = false,
}: ParameterItemSectionProps) {
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
        <div className="flex items-center">
          <RangeSlider
            min={1}
            max={Math.min(5, validFieldIds.length)}
            value={[
              minMax.min ?? 1,
              Math.min(Math.min(5, validFieldIds.length), minMax.max ?? 2),
            ]}
            onValueChange={([min, max]) =>
              onMinMaxChange({
                min,
                max: Math.min(Math.min(5, validFieldIds.length), max),
              })
            }
            disabled={isReadonly || disabled}
            className="w-[200px] mr-4"
          />
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onRandomize}
                  disabled={isReadonly || disabled}
                >
                  <Shuffle className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Randomize</TooltipContent>
            </Tooltip>
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
