/**
 * SimulationSlider.tsx
 * Used to pick a value for a certain item as part of the simulation
 * @AshokSaravanan222 & @siladiea
 * 06/10/2025
 */

"use client";
import { SliderProps } from "@radix-ui/react-slider";
import { X } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";

export interface ScenarioSliderProps {
  leftContent?: React.ReactNode;
  rightContent?: React.ReactNode;
  defaultValue: SliderProps["defaultValue"];
  label?: string;
  description?: string;
  min?: number;
  max?: number;
  step?: number;
  onValueChange?: (value: number[]) => void;
  value?: number[];
  disabled?: boolean;
  showReset?: boolean;
  onReset?: () => void;
  inlineTitle?: boolean;
}

export function ScenarioSlider({
  leftContent,
  rightContent,
  defaultValue,
  label = "Temperature",
  description = "Controls randomness: lowering results in less random completions. As the temperature approaches zero, the model will become deterministic and repetitive.",
  min = 0,
  max = 1,
  step = 0.1,
  onValueChange: externalOnValueChange,
  value: externalValue,
  disabled = false,
  showReset = false,
  onReset,
  inlineTitle = false,
}: ScenarioSliderProps) {
  const [internalValue, setInternalValue] = React.useState(defaultValue);

  // Use external value if provided, otherwise use internal state
  const value = externalValue || internalValue;

  const handleValueChange = (newValue: number[]) => {
    if (disabled) return;
    if (!externalValue) {
      setInternalValue(newValue);
    }
    externalOnValueChange?.(newValue);
  };

  return (
    <div className="grid gap-2 pt-2">
      <HoverCard openDelay={200}>
        <HoverCardTrigger asChild>
          <div className="grid gap-4">
            {inlineTitle ? (
              <div className="flex items-center justify-between">
                <Label
                  htmlFor="slider"
                  className={disabled ? "text-muted-foreground" : ""}
                >
                  {label}
                </Label>
                <div className="flex items-center gap-2">
                  <span
                    className={`w-12 rounded-md border border-transparent px-2 py-0.5 text-right text-sm ${disabled ? "text-muted-foreground" : "text-muted-foreground hover:border-border"}`}
                  >
                    {disabled ? "N/A" : value}
                  </span>
                  {showReset && onReset && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={onReset}
                      className="h-6 w-6 p-0 hover:bg-muted"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                {leftContent}
                <div className="flex items-center w-full justify-end">
                  <Label
                    htmlFor="slider"
                    className={disabled ? "text-muted-foreground" : ""}
                  >
                    {label}
                  </Label>
                  <span
                    className={`w-12 rounded-md border border-transparent px-2 py-0.5 text-right text-sm ${disabled ? "text-muted-foreground" : "text-muted-foreground hover:border-border"}`}
                  >
                    {disabled ? "N/A" : value}
                  </span>
                  {rightContent}
                </div>
              </div>
            )}
            <Slider
              id="slider"
              min={min}
              max={max}
              defaultValue={value ?? []}
              step={step}
              onValueChange={handleValueChange}
              className={`[&_[role=slider]]:h-4 [&_[role=slider]]:w-4 ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
              aria-label={label}
              disabled={disabled}
            />
          </div>
        </HoverCardTrigger>
        <HoverCardContent
          align="start"
          className="w-[260px] text-sm"
          side="left"
        >
          {description}
        </HoverCardContent>
      </HoverCard>
    </div>
  );
}
