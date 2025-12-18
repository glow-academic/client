/**
 * SettingsChartColorsSection.tsx
 * Chart colors section with individual cards for each color picker
 */
"use client";

import { Check, RotateCcw, Search } from "lucide-react";
import React, { forwardRef, useMemo, useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

// Preset colors (same as PersonaColorSection)
const presetColors = [
  "#ef4444",
  "#f97316",
  "#f59e0b",
  "#eab308",
  "#84cc16",
  "#22c55e",
  "#10b981",
  "#14b8a6",
  "#06b6d4",
  "#0ea5e9",
  "#3b82f6",
  "#6366f1",
  "#8b5cf6",
  "#a855f7",
  "#d946ef",
  "#ec4899",
  "#f43f5e",
  "#000000",
  "#ffffff",
  "#808080",
];

// Color name mapping for common hex colors
const getColorName = (hex: string): string => {
  const colorMap: Record<string, string> = {
    "#000000": "Black",
    "#FFFFFF": "White",
    "#FF0000": "Red",
    "#00FF00": "Green",
    "#0000FF": "Blue",
    "#FFFF00": "Yellow",
    "#FF00FF": "Magenta",
    "#00FFFF": "Cyan",
    "#FFA500": "Orange",
    "#800080": "Purple",
    "#FFC0CB": "Pink",
    "#A52A2A": "Brown",
    "#808080": "Gray",
    "#FFD700": "Gold",
    "#C0C0C0": "Silver",
    "#008000": "Dark Green",
    "#000080": "Navy",
    "#800000": "Maroon",
    "#EF4444": "Red",
    "#F97316": "Orange",
    "#F59E0B": "Amber",
    "#EAB308": "Yellow",
    "#84CC16": "Lime",
    "#22C55E": "Green",
    "#10B981": "Emerald",
    "#14B8A6": "Teal",
    "#06B6D4": "Cyan",
    "#0EA5E9": "Sky",
    "#3B82F6": "Blue",
    "#6366F1": "Indigo",
    "#8B5CF6": "Violet",
    "#A855F7": "Purple",
    "#D946EF": "Fuchsia",
    "#EC4899": "Pink",
    "#F43F5E": "Rose",
  };

  const normalizedHex = hex.toUpperCase().startsWith("#")
    ? hex.toUpperCase()
    : `#${hex.toUpperCase()}`;

  return colorMap[normalizedHex] || "Custom";
};

interface ChartColorCardProps {
  label: string;
  fieldName: "chart1" | "chart2" | "chart3" | "chart4" | "chart5";
  value: string;
  originalValue: string;
  onColorChange: (
    fieldName: "chart1" | "chart2" | "chart3" | "chart4" | "chart5",
    value: string,
  ) => void;
  onReset: () => void;
  stepStatus: "pending" | "active" | "completed";
  stepNumber: number;
  isReadonly: boolean;
  hideCardWrapper?: boolean;
}

export const ChartColorCard = forwardRef<HTMLDivElement, ChartColorCardProps>(
  (
    {
      label,
      fieldName,
      value,
      originalValue,
      onColorChange,
      onReset,
      stepStatus,
      stepNumber,
      isReadonly,
      hideCardWrapper = false,
    },
    ref,
  ) => {
    const [searchTerm, setSearchTerm] = useState("");

    // Normalize current value for comparison
    const normalizedValue = useMemo(() => {
      if (!value) return "";
      return value.toUpperCase().startsWith("#")
        ? value.toUpperCase()
        : `#${value.toUpperCase()}`;
    }, [value]);

    // Add current value to colors list if not already present
    const allColors = useMemo(() => {
      const colorsSet = new Set(presetColors.map((c) => c.toLowerCase()));
      if (normalizedValue && !colorsSet.has(normalizedValue.toLowerCase())) {
        return [normalizedValue, ...presetColors];
      }
      return presetColors;
    }, [normalizedValue]);

    // Filter and sort colors: selected first, then others
    const filteredColors = useMemo(() => {
      let colors = allColors;

      if (searchTerm.trim()) {
        const searchLower = searchTerm.toLowerCase();
        colors = allColors.filter((colorValue) => {
          const colorName = getColorName(colorValue).toLowerCase();
          const colorHex = colorValue.toLowerCase();
          return (
            colorName.includes(searchLower) || colorHex.includes(searchLower)
          );
        });
      }

      // Sort: selected colors first
      return colors.sort((a, b) => {
        const aSelected = a.toLowerCase() === normalizedValue.toLowerCase();
        const bSelected = b.toLowerCase() === normalizedValue.toLowerCase();
        if (aSelected && !bSelected) return -1;
        if (!aSelected && bSelected) return 1;
        return 0;
      });
    }, [allColors, searchTerm, normalizedValue]);

    const handleColorSelect = (selectedColor: string) => {
      if (isReadonly) return;
      // Allow unselection if clicking already selected color
      if (selectedColor.toLowerCase() === normalizedValue.toLowerCase()) {
        onColorChange(fieldName, "");
        return;
      }
      onColorChange(fieldName, selectedColor);
    };

    const handleHexInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      if (val === "" || /^#?[0-9A-Fa-f]*$/.test(val)) {
        onColorChange(fieldName, val.startsWith("#") ? val : `#${val}`);
      }
    };

    const content = (
      <div className="space-y-4">
        {/* Search Bar */}
        <div className="flex h-9 items-center gap-2 border-b px-0 w-full">
          <Search className="size-4 shrink-0 opacity-50" />
          <input
            type="text"
            placeholder="Search colors..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="placeholder:text-muted-foreground flex h-9 w-full bg-transparent py-2 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isReadonly}
          />
        </div>

        {/* Vertical Grid Color Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[272px] overflow-y-auto py-2 px-2">
          {filteredColors.length === 0 ? (
            <div className="col-span-full text-center py-8 text-muted-foreground">
              No colors found. Try adjusting your search.
            </div>
          ) : (
            filteredColors.map((colorValue) => {
              const isSelected =
                colorValue.toLowerCase() === normalizedValue.toLowerCase();

              return (
                <button
                  key={colorValue}
                  type="button"
                  onClick={() => handleColorSelect(colorValue)}
                  disabled={isReadonly}
                  className={cn(
                    "relative flex flex-col gap-3 p-4 rounded-xl border bg-card text-card-foreground shadow-sm transition-all text-left",
                    "hover:shadow-md hover:bg-accent/50",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    "disabled:pointer-events-none disabled:opacity-50",
                    isSelected && "ring-2 ring-primary bg-accent",
                  )}
                >
                  {isSelected && (
                    <div className="absolute top-2 right-2 z-10 h-6 w-6 bg-primary rounded-full flex items-center justify-center">
                      <Check className="h-3.5 w-3.5 text-primary-foreground" />
                    </div>
                  )}

                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-lg border-2 border-border shrink-0"
                      style={{ backgroundColor: colorValue }}
                    />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-sm leading-tight">
                        {getColorName(colorValue)}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {colorValue}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Hex Input */}
        <div className="space-y-2">
          <Label htmlFor={`hex-${fieldName}`}>Hex Color</Label>
          <div className="flex gap-2">
            <Input
              id={`hex-${fieldName}`}
              value={value}
              onChange={handleHexInputChange}
              placeholder="#000000"
              className="flex-1"
              disabled={isReadonly}
            />
            <div
              className="w-10 h-10 rounded border shrink-0"
              style={{ backgroundColor: value }}
            />
          </div>
        </div>
      </div>
    );

    if (hideCardWrapper) {
      return <div ref={ref}>{content}</div>;
    }

    return (
      <Card
        ref={ref}
        className={cn(
          "transition-all",
          stepStatus === "active" && "ring-2 ring-primary",
          stepStatus === "pending" && "opacity-50",
        )}
      >
        <CardHeader className="flex flex-row items-center space-y-0 pb-4 justify-between">
          <div className="flex items-center space-x-3 flex-1 min-w-0">
            <div
              className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium shrink-0",
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
            <div className="flex-1 min-w-0">
              <CardTitle className="text-lg">{label}</CardTitle>
            </div>
          </div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={onReset}
                  disabled={isReadonly || value === originalValue}
                  className="h-8 w-8"
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Reset to original value</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </CardHeader>
        <CardContent className="space-y-4">{content}</CardContent>
      </Card>
    );
  },
);

ChartColorCard.displayName = "ChartColorCard";

export interface ChartColors {
  chart1: string;
  chart2: string;
  chart3: string;
  chart4: string;
  chart5: string;
}

export interface SettingsChartColorsSectionProps {
  colors: ChartColors;
  originalColors: ChartColors;
  onColorChange: (fieldName: keyof ChartColors, value: string) => void;
  onResetColor: (fieldName: keyof ChartColors) => void;
  stepStatus: "pending" | "active" | "completed";
  stepNumber: number;
  isReadonly: boolean;
  cardRefs?: {
    chart1Ref?: React.RefObject<HTMLDivElement | null>;
    chart2Ref?: React.RefObject<HTMLDivElement | null>;
    chart3Ref?: React.RefObject<HTMLDivElement | null>;
    chart4Ref?: React.RefObject<HTMLDivElement | null>;
    chart5Ref?: React.RefObject<HTMLDivElement | null>;
  };
}

export function SettingsChartColorsSection({
  colors,
  originalColors,
  onColorChange,
  onResetColor,
  stepStatus,
  stepNumber,
  isReadonly,
  cardRefs,
}: SettingsChartColorsSectionProps) {
  return (
    <div className="space-y-6">
      {/* Individual Chart Color Cards */}
      <ChartColorCard
        ref={cardRefs?.chart1Ref}
        label="Chart 1"
        fieldName="chart1"
        value={colors.chart1}
        originalValue={originalColors.chart1}
        onColorChange={onColorChange}
        onReset={() => onResetColor("chart1")}
        stepStatus={stepStatus}
        stepNumber={stepNumber}
        isReadonly={isReadonly}
      />

      <ChartColorCard
        ref={cardRefs?.chart2Ref}
        label="Chart 2"
        fieldName="chart2"
        value={colors.chart2}
        originalValue={originalColors.chart2}
        onColorChange={onColorChange}
        onReset={() => onResetColor("chart2")}
        stepStatus={stepStatus}
        stepNumber={stepNumber + 1}
        isReadonly={isReadonly}
      />

      <ChartColorCard
        ref={cardRefs?.chart3Ref}
        label="Chart 3"
        fieldName="chart3"
        value={colors.chart3}
        originalValue={originalColors.chart3}
        onColorChange={onColorChange}
        onReset={() => onResetColor("chart3")}
        stepStatus={stepStatus}
        stepNumber={stepNumber + 2}
        isReadonly={isReadonly}
      />

      <ChartColorCard
        ref={cardRefs?.chart4Ref}
        label="Chart 4"
        fieldName="chart4"
        value={colors.chart4}
        originalValue={originalColors.chart4}
        onColorChange={onColorChange}
        onReset={() => onResetColor("chart4")}
        stepStatus={stepStatus}
        stepNumber={stepNumber + 3}
        isReadonly={isReadonly}
      />

      <ChartColorCard
        ref={cardRefs?.chart5Ref}
        label="Chart 5"
        fieldName="chart5"
        value={colors.chart5}
        originalValue={originalColors.chart5}
        onColorChange={onColorChange}
        onReset={() => onResetColor("chart5")}
        stepStatus={stepStatus}
        stepNumber={stepNumber + 4}
        isReadonly={isReadonly}
      />
    </div>
  );
}
