/**
 * SimulationCompositionPicker.tsx
 * Component for selecting statistical configurations for simulation composition analysis
 * @AshokSaravanan222
 * 07/23/2025
 */
"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Settings, TrendingDown, TrendingUp } from "lucide-react";
import { useState } from "react";

export interface SimulationCompositionConfig {
  method: "percentile" | "standard_deviation" | "quartile";
  topPercentage: number;
  bottomPercentage: number;
  description: string;
}

interface SimulationCompositionPickerProps {
  onConfigChange: (config: SimulationCompositionConfig) => void;
  currentConfig: SimulationCompositionConfig;
}

const PRESET_CONFIGS: SimulationCompositionConfig[] = [
  {
    method: "percentile",
    topPercentage: 25,
    bottomPercentage: 25,
    description: "Top 25% vs Bottom 25% - Best vs Worst",
  },
  {
    method: "percentile",
    topPercentage: 50,
    bottomPercentage: 50,
    description: "Top 50% vs Bottom 50% - Balanced Comparison",
  },
  {
    method: "quartile",
    topPercentage: 25,
    bottomPercentage: 25,
    description: "Q1 vs Q4 - Quartile Analysis",
  },
  {
    method: "standard_deviation",
    topPercentage: 15,
    bottomPercentage: 15,
    description: "±1σ - Statistical Outliers",
  },
];

export default function SimulationCompositionPicker({
  onConfigChange,
  currentConfig,
}: SimulationCompositionPickerProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const handlePresetSelect = (config: SimulationCompositionConfig) => {
    onConfigChange(config);
  };

  const handleMethodChange = (
    method: SimulationCompositionConfig["method"]
  ) => {
    let newConfig: SimulationCompositionConfig;

    switch (method) {
      case "percentile":
        newConfig = {
          method,
          topPercentage: 25,
          bottomPercentage: 25,
          description: "Top 25% vs Bottom 25% - Percentile Analysis",
        };
        break;
      case "quartile":
        newConfig = {
          method,
          topPercentage: 25,
          bottomPercentage: 25,
          description: "Q1 vs Q4 - Quartile Analysis",
        };
        break;
      case "standard_deviation":
        newConfig = {
          method,
          topPercentage: 15,
          bottomPercentage: 15,
          description: "±1σ - Statistical Outliers",
        };
        break;
      default:
        newConfig = currentConfig;
    }

    onConfigChange(newConfig);
  };

  const handleTopPercentageChange = (value: number[]) => {
    const newValue = value[0] ?? currentConfig.topPercentage;
    onConfigChange({
      ...currentConfig,
      topPercentage: newValue,
      description: `Top ${newValue}% vs Bottom ${currentConfig.bottomPercentage}%`,
    });
  };

  const handleBottomPercentageChange = (value: number[]) => {
    const newValue = value[0] ?? currentConfig.bottomPercentage;
    onConfigChange({
      ...currentConfig,
      bottomPercentage: newValue,
      description: `Top ${currentConfig.topPercentage}% vs Bottom ${newValue}%`,
    });
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            <CardTitle className="text-sm">Analysis Configuration</CardTitle>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? "Hide" : "Configure"}
          </Button>
        </div>
        <CardDescription className="text-xs">
          {currentConfig.description}
        </CardDescription>
      </CardHeader>

      {isExpanded && (
        <CardContent className="space-y-4 pt-0">
          {/* Preset Configurations */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium">Quick Presets</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {PRESET_CONFIGS.map((config, index) => (
                <Button
                  key={index}
                  variant={
                    currentConfig.method === config.method &&
                    currentConfig.topPercentage === config.topPercentage &&
                    currentConfig.bottomPercentage === config.bottomPercentage
                      ? "default"
                      : "outline"
                  }
                  size="sm"
                  className="justify-start text-left h-auto p-3"
                  onClick={() => handlePresetSelect(config)}
                >
                  <div className="flex flex-col items-start">
                    <div className="flex items-center gap-2 text-xs">
                      <TrendingUp className="h-3 w-3 text-green-600" />
                      <span>Top {config.topPercentage}%</span>
                      <TrendingDown className="h-3 w-3 text-red-600" />
                      <span>Bottom {config.bottomPercentage}%</span>
                    </div>
                    <span className="text-xs text-muted-foreground mt-1">
                      {config.description.split(" - ")[1]}
                    </span>
                  </div>
                </Button>
              ))}
            </div>
          </div>

          {/* Custom Configuration */}
          <div className="space-y-4 pt-2 border-t">
            <h4 className="text-sm font-medium">Custom Configuration</h4>

            {/* Method Selection */}
            <div className="space-y-2">
              <label className="text-xs font-medium">Statistical Method</label>
              <Select
                value={currentConfig.method}
                onValueChange={handleMethodChange}
              >
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentile">
                    <div className="flex flex-col">
                      <span>Percentile</span>
                      <span className="text-xs text-muted-foreground">
                        Based on percentage ranking
                      </span>
                    </div>
                  </SelectItem>
                  <SelectItem value="quartile">
                    <div className="flex flex-col">
                      <span>Quartile</span>
                      <span className="text-xs text-muted-foreground">
                        Q1 vs Q4 analysis
                      </span>
                    </div>
                  </SelectItem>
                  <SelectItem value="standard_deviation">
                    <div className="flex flex-col">
                      <span>Standard Deviation</span>
                      <span className="text-xs text-muted-foreground">
                        ±σ from mean
                      </span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Top Percentage Slider */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium flex items-center gap-1">
                  <TrendingUp className="h-3 w-3 text-green-600" />
                  Top Percentage
                </label>
                <span className="text-xs text-muted-foreground">
                  {currentConfig.topPercentage}%
                </span>
              </div>
              <Slider
                value={[currentConfig.topPercentage]}
                onValueChange={handleTopPercentageChange}
                max={50}
                min={5}
                step={5}
                className="w-full"
              />
            </div>

            {/* Bottom Percentage Slider */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium flex items-center gap-1">
                  <TrendingDown className="h-3 w-3 text-red-600" />
                  Bottom Percentage
                </label>
                <span className="text-xs text-muted-foreground">
                  {currentConfig.bottomPercentage}%
                </span>
              </div>
              <Slider
                value={[currentConfig.bottomPercentage]}
                onValueChange={handleBottomPercentageChange}
                max={50}
                min={5}
                step={5}
                className="w-full"
              />
            </div>

            {/* Method Description */}
            <div className="text-xs text-muted-foreground p-2 bg-muted rounded">
              <strong>Method:</strong>{" "}
              {currentConfig.method === "percentile" &&
                "Selects simulations based on their percentile ranking in the dataset."}
              {currentConfig.method === "quartile" &&
                "Uses quartile analysis to identify Q1 (top 25%) and Q4 (bottom 25%) performers."}
              {currentConfig.method === "standard_deviation" &&
                "Identifies statistical outliers based on standard deviation from the mean performance."}
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
