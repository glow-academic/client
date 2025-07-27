/**
 * SimulationCompositionPicker.tsx
 * Component for selecting statistical configurations for simulation composition analysis
 * @AshokSaravanan222
 * 07/23/2025
 */
"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, Settings } from "lucide-react";

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
  const selectedConfig = (PRESET_CONFIGS.find(
    (config) =>
      config.method === currentConfig.method &&
      config.topPercentage === currentConfig.topPercentage &&
      config.bottomPercentage === currentConfig.bottomPercentage,
  ) ?? PRESET_CONFIGS[0]) as SimulationCompositionConfig;

  const getConfigLabel = (config: SimulationCompositionConfig) => {
    switch (config.method) {
      case "percentile":
        return `Top ${config.topPercentage}% vs Bottom ${config.bottomPercentage}%`;
      case "quartile":
        return "Q1 vs Q4 - Quartile Analysis";
      case "standard_deviation":
        return "±1σ - Statistical Outliers";
      default:
        return config.description;
    }
  };

  const getConfigIcon = (config: SimulationCompositionConfig) => {
    switch (config.method) {
      case "percentile":
        return "📊";
      case "quartile":
        return "📈";
      case "standard_deviation":
        return "📉";
      default:
        return "⚙️";
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-8">
          <Settings className="h-4 w-4 mr-2" />
          {getConfigIcon(selectedConfig)} {getConfigLabel(selectedConfig)}
          <ChevronDown className="h-4 w-4 ml-2" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        {PRESET_CONFIGS.map((config, index) => (
          <DropdownMenuItem
            key={index}
            onClick={() => onConfigChange(config)}
            className="flex items-start gap-3 p-3 cursor-pointer"
          >
            <div className="flex items-center gap-2 flex-1">
              <span className="text-lg">{getConfigIcon(config)}</span>
              <div className="flex flex-col">
                <span className="font-medium">{getConfigLabel(config)}</span>
                <span className="text-xs text-muted-foreground">
                  {config.description.split(" - ")[1]}
                </span>
              </div>
            </div>
            {selectedConfig.method === config.method &&
              selectedConfig.topPercentage === config.topPercentage &&
              selectedConfig.bottomPercentage === config.bottomPercentage && (
                <div className="w-2 h-2 bg-primary rounded-full" />
              )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
