/**
 * SimulationSlider.tsx
 * Used to pick a value for a certain item as part of the simulation
 * @AshokSaravanan222 & @siladiea
 * 06/10/2025
 */

"use client"
import * as React from "react"
import { SliderProps } from "@radix-ui/react-slider"

import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"

interface ScenarioSliderProps {
  defaultValue: SliderProps["defaultValue"]
  label?: string
  description?: string
  min?: number
  max?: number
  step?: number
  onValueChange?: (value: number[]) => void
  value?: number[]
}

export function ScenarioSlider({
  defaultValue,
  label = "Temperature",
  description = "Controls randomness: lowering results in less random completions. As the temperature approaches zero, the model will become deterministic and repetitive.",
  min = 0,
  max = 1,
  step = 0.1,
  onValueChange: externalOnValueChange,
  value: externalValue,
}: ScenarioSliderProps) {
  const [internalValue, setInternalValue] = React.useState(defaultValue)

  // Use external value if provided, otherwise use internal state
  const value = externalValue || internalValue

  const handleValueChange = (newValue: number[]) => {
    if (!externalValue) {
      setInternalValue(newValue)
    }
    externalOnValueChange?.(newValue)
  }

  return (
    <div className="grid gap-2 pt-2">
      <HoverCard openDelay={200}>
        <HoverCardTrigger asChild>
          <div className="grid gap-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="slider">{label}</Label>
              <span className="w-12 rounded-md border border-transparent px-2 py-0.5 text-right text-sm text-muted-foreground hover:border-border">
                {value}
              </span>
            </div>
            <Slider
              id="slider"
              min={min}
              max={max}
              defaultValue={value}
              step={step}
              onValueChange={handleValueChange}
              className="[&_[role=slider]]:h-4 [&_[role=slider]]:w-4"
              aria-label={label}
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
  )
}
