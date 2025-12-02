/**
 * TemperatureBoundsPicker.tsx
 * Used to configure temperature bounds for models (range or discrete values)
 * @AshokSaravanan222
 * 12/02/2025
 */

"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type TemperatureBoundsType = "range" | "values";

export interface TemperatureBounds {
  type: TemperatureBoundsType;
  lower?: number;
  upper?: number;
  values?: number[];
}

export interface TemperatureBoundsPickerProps {
  bounds: TemperatureBounds;
  onBoundsChange: (bounds: TemperatureBounds) => void;
  disabled?: boolean;
}

export function TemperatureBoundsPicker({
  bounds,
  onBoundsChange,
  disabled = false,
}: TemperatureBoundsPickerProps) {
  const [localBounds, setLocalBounds] = React.useState<TemperatureBounds>(bounds);

  React.useEffect(() => {
    setLocalBounds(bounds);
  }, [bounds]);

  const handleTypeChange = (type: TemperatureBoundsType) => {
    if (type === "range") {
      setLocalBounds({
        type: "range",
        lower: localBounds.lower ?? 0.0,
        upper: localBounds.upper ?? 1.0,
      });
      onBoundsChange({
        type: "range",
        lower: localBounds.lower ?? 0.0,
        upper: localBounds.upper ?? 1.0,
      });
    } else {
      setLocalBounds({
        type: "values",
        values: localBounds.values ?? [0.0, 0.5, 1.0],
      });
      onBoundsChange({
        type: "values",
        values: localBounds.values ?? [0.0, 0.5, 1.0],
      });
    }
  };

  const handleRangeChange = (field: "lower" | "upper", value: number) => {
    const newBounds = {
      ...localBounds,
      [field]: Math.max(0.0, Math.min(2.0, value)),
    };
    setLocalBounds(newBounds);
    onBoundsChange(newBounds);
  };

  const handleValuesChange = (index: number, value: number) => {
    const newValues = [...(localBounds.values || [])];
    newValues[index] = Math.max(0.0, Math.min(2.0, value));
    newValues.sort((a, b) => a - b);
    const newBounds = {
      type: "values" as const,
      values: newValues,
    };
    setLocalBounds(newBounds);
    onBoundsChange(newBounds);
  };

  const handleAddValue = () => {
    const currentValues = localBounds.values || [];
    const maxValue = currentValues.length > 0 ? Math.max(...currentValues) : 1.0;
    const newValue = Math.min(2.0, maxValue + 0.1);
    const newValues = [...currentValues, newValue].sort((a, b) => a - b);
    const newBounds = {
      type: "values" as const,
      values: newValues,
    };
    setLocalBounds(newBounds);
    onBoundsChange(newBounds);
  };

  const handleRemoveValue = (index: number) => {
    const newValues = (localBounds.values || []).filter((_, i) => i !== index);
    const newBounds = {
      type: "values" as const,
      values: newValues,
    };
    setLocalBounds(newBounds);
    onBoundsChange(newBounds);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Temperature Bounds Type</Label>
        <RadioGroup
          value={localBounds.type}
          onValueChange={handleTypeChange}
          disabled={disabled}
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="range" id="range" />
            <Label htmlFor="range" className="font-normal cursor-pointer">
              Range (Min/Max)
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="values" id="values" />
            <Label htmlFor="values" className="font-normal cursor-pointer">
              Discrete Values
            </Label>
          </div>
        </RadioGroup>
      </div>

      {localBounds.type === "range" && (
        <div className="space-y-4">
          <div className="grid gap-4 grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="temperature-lower">Lower Bound</Label>
              <Input
                id="temperature-lower"
                type="number"
                step="0.01"
                min="0"
                max="2"
                value={localBounds.lower ?? 0.0}
                onChange={(e) =>
                  handleRangeChange("lower", parseFloat(e.target.value) || 0.0)
                }
                disabled={disabled}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="temperature-upper">Upper Bound</Label>
              <Input
                id="temperature-upper"
                type="number"
                step="0.01"
                min="0"
                max="2"
                value={localBounds.upper ?? 1.0}
                onChange={(e) =>
                  handleRangeChange("upper", parseFloat(e.target.value) || 1.0)
                }
                disabled={disabled}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>
              Range: {localBounds.lower?.toFixed(2) ?? "0.00"} -{" "}
              {localBounds.upper?.toFixed(2) ?? "1.00"}
            </Label>
            <Slider
              value={[localBounds.lower ?? 0.0, localBounds.upper ?? 1.0]}
              min={0}
              max={2}
              step={0.01}
              onValueChange={(values) => {
                handleRangeChange("lower", values[0]!);
                handleRangeChange("upper", values[1]!);
              }}
              disabled={disabled}
              className="w-full"
            />
          </div>
        </div>
      )}

      {localBounds.type === "values" && (
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Discrete Temperature Values</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddValue}
                disabled={disabled}
              >
                Add Value
              </Button>
            </div>
            <div className="space-y-2">
              {(localBounds.values || []).map((value, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    max="2"
                    value={value}
                    onChange={(e) =>
                      handleValuesChange(
                        index,
                        parseFloat(e.target.value) || 0.0
                      )
                    }
                    disabled={disabled}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveValue(index)}
                    disabled={disabled || (localBounds.values?.length ?? 0) <= 1}
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>
            {(!localBounds.values || localBounds.values.length === 0) && (
              <p className="text-sm text-muted-foreground">
                No values configured. Click "Add Value" to add temperature
                values.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

