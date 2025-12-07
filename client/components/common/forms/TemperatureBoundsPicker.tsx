/**
 * TemperatureBoundsPicker.tsx
 * Used to configure temperature bounds for models (range only)
 * @AshokSaravanan222
 * 12/02/2025
 */

"use client";

import * as React from "react";

import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";

export interface TemperatureBounds {
  type: "range";
  lower: number;
  upper: number;
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
  const lower = bounds.lower ?? 0.0;
  const upper = bounds.upper ?? 1.0;

  const handleSliderChange = (values: number[]) => {
    if (
      values.length >= 2 &&
      values[0] !== undefined &&
      values[1] !== undefined
    ) {
      onBoundsChange({
        type: "range",
        lower: Math.max(0.0, Math.min(2.0, values[0])),
        upper: Math.max(0.0, Math.min(2.0, values[1])),
      });
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Slider
          value={[lower, upper]}
          min={0}
          max={2}
          step={0.01}
          onValueChange={handleSliderChange}
          disabled={disabled}
          className="w-full"
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{lower.toFixed(2)} (Lower)</span>
          <span>{upper.toFixed(2)} (Upper)</span>
        </div>
      </div>
    </div>
  );
}
