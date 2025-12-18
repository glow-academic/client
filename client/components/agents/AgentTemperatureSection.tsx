/**
 * AgentTemperatureSection.tsx
 * Temperature configuration section component for Agent
 */
"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

type StepStatus = "pending" | "active" | "completed";

export interface AgentTemperatureSectionProps {
  // Data
  temperature: number;
  temperatureBounds: {
    lower: number;
    upper: number;
    values: string[];
    levels: Array<{
      id: string;
      temperature: string;
      is_upper: boolean;
    }>;
  };
  model_temperature_level_id: string | null;

  // Callbacks
  onTemperatureChange: (temperature: number) => void;
  onTemperatureLevelIdChange: (levelId: string | null) => void;

  // UI State
  stepStatus: StepStatus;
  stepTitle: string;
  stepDescription: string;
  stepNumber: number;
  isReadonly: boolean;
}

export function AgentTemperatureSection({
  temperature,
  temperatureBounds,
  model_temperature_level_id: _model_temperature_level_id,
  onTemperatureChange,
  onTemperatureLevelIdChange,
  stepStatus,
  stepTitle,
  stepDescription,
  stepNumber,
  isReadonly,
}: AgentTemperatureSectionProps) {
  // Helper to get temperature level ID from temperature value
  const getTemperatureLevelId = (temp: number): string | null => {
    const levels = temperatureBounds.levels || [];
    const matchingLevel = levels.find(
      (l) => !l.is_upper && Math.abs(parseFloat(l.temperature) - temp) < 0.001,
    );
    return matchingLevel?.id || null;
  };

  return (
    <Card
      className={cn(
        "transition-all",
        stepStatus === "active" && "ring-2 ring-primary",
        stepStatus === "pending" && "opacity-50",
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
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="temperature">
            Temperature:{" "}
            {temperature !== undefined ? temperature.toFixed(2) : "0.00"}
          </Label>
          {temperature !== undefined ? (
            <>
              {/* Handle case when upper and lower bounds are equal */}
              {temperatureBounds.lower === temperatureBounds.upper ? (
                <>
                  {/* Single point slider - span full width with single value */}
                  <Slider
                    id="temperature"
                    data-testid="temperature-slider"
                    min={temperatureBounds.lower}
                    max={temperatureBounds.upper}
                    step={0.01}
                    value={[temperature || temperatureBounds.lower]}
                    onValueChange={(value) => {
                      const tempValue = value[0] || temperatureBounds.lower;
                      const levelId = getTemperatureLevelId(tempValue);
                      onTemperatureChange(tempValue);
                      onTemperatureLevelIdChange(levelId);
                    }}
                    className="w-full"
                    disabled={isReadonly}
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>
                      {temperatureBounds.lower.toFixed(2)} (Deterministic)
                    </span>
                    <span>{temperatureBounds.upper.toFixed(2)} (Creative)</span>
                  </div>
                </>
              ) : (
                <>
                  {/* Normal slider with different bounds */}
                  <Slider
                    id="temperature"
                    data-testid="temperature-slider"
                    min={temperatureBounds.lower}
                    max={temperatureBounds.upper}
                    step={0.01}
                    value={[temperature || 0]}
                    onValueChange={(value) => {
                      const tempValue = value[0] || 0;
                      const levelId = getTemperatureLevelId(tempValue);
                      onTemperatureChange(tempValue);
                      onTemperatureLevelIdChange(levelId);
                    }}
                    className="w-full"
                    disabled={isReadonly}
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>
                      {temperatureBounds.lower.toFixed(2)} (Deterministic)
                    </span>
                    <span>{temperatureBounds.upper.toFixed(2)} (Creative)</span>
                  </div>
                </>
              )}
            </>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
