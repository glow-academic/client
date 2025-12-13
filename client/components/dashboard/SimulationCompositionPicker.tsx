/**
 * SimulationCompositionPicker.tsx
 * Component for selecting statistical configurations for simulation composition analysis
 * @AshokSaravanan222
 * 07/23/2025
 */
"use client";

import { GenericPicker } from "@/components/common/forms/GenericPicker";
import { useMemo } from "react";

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

// Helper to create a unique ID for a config
const getConfigId = (config: SimulationCompositionConfig): string => {
  return `${config.method}-${config.topPercentage}-${config.bottomPercentage}`;
};

export default function SimulationCompositionPicker({
  onConfigChange,
  currentConfig,
}: SimulationCompositionPickerProps) {
  // Build mapping for GenericPicker
  const configMapping = useMemo(() => {
    const mapping: Record<string, { name: string; description: string }> = {};
    PRESET_CONFIGS.forEach((config) => {
      const id = getConfigId(config);
      const getConfigLabel = (c: SimulationCompositionConfig) => {
        switch (c.method) {
          case "percentile":
            return `Top ${c.topPercentage}% vs Bottom ${c.bottomPercentage}%`;
          case "quartile":
            return "Q1 vs Q4 - Quartile Analysis";
          case "standard_deviation":
            return "±1σ - Statistical Outliers";
          default:
            return c.description;
        }
      };
      mapping[id] = {
        name: getConfigLabel(config),
        description: config.description.split(" - ")[1] || config.description,
      };
    });
    return mapping;
  }, []);

  const validConfigIds = useMemo(() => {
    return PRESET_CONFIGS.map((config) => getConfigId(config));
  }, []);

  const selectedConfigId = useMemo(() => {
    return getConfigId(currentConfig);
  }, [currentConfig]);

  const handleSelect = (ids: string[]) => {
    const id = ids[0] || "";
    const config = PRESET_CONFIGS.find((c) => getConfigId(c) === id);
    if (config) {
      onConfigChange(config);
    }
  };

  return (
    <GenericPicker
      items={configMapping}
      itemIds={validConfigIds}
      selectedIds={selectedConfigId ? [selectedConfigId] : []}
      onSelect={handleSelect}
      getId={(item) => {
        const entry = Object.entries(configMapping).find(([, v]) => v === item);
        return entry ? entry[0] : "";
      }}
      getLabel={(item) => item.name}
      placeholder="Select configuration..."
      searchPlaceholder="Search configurations..."
      emptyMessage="No configuration found."
      groupHeading="Configurations"
      buttonClassName="w-64"
    />
  );
}
