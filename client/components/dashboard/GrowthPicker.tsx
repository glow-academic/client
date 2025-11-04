"use client";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ChevronsUpDown } from "lucide-react";
import { useState } from "react";

// Define the available metrics for the growth picker
export interface GrowthMetric {
  id: string;
  name: string;
  color: string;
  description: string;
  unit: string;
  formatter?: (value: number) => string;
}

export interface GrowthPickerProps {
  availableMetrics: GrowthMetric[];
  selectedMetrics: string[];
  onMetricsChange: (metrics: string[]) => void;
}

export default function GrowthPicker({
  availableMetrics,
  selectedMetrics,
  onMetricsChange,
}: GrowthPickerProps) {
  const [open, setOpen] = useState(false);

  const handleMetricToggle = (metricId: string) => {
    const newSelectedMetrics = selectedMetrics.includes(metricId)
      ? selectedMetrics.filter((id) => id !== metricId)
      : [...selectedMetrics, metricId];

    // Prevent deselecting all metrics - ensure at least one is always selected
    if (newSelectedMetrics.length === 0) {
      return; // Don't allow deselecting the last metric
    }

    onMetricsChange(newSelectedMetrics);
  };

  const getButtonText = () => {
    if (selectedMetrics.length === 0) return "Select metrics...";
    if (selectedMetrics.length === 1) {
      const metric = availableMetrics.find((m) => m.id === selectedMetrics[0]);
      return metric?.name || "1 metric selected";
    }
    return `${selectedMetrics.length} metrics selected`;
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-48 justify-between"
        >
          <span className="truncate text-left">{getButtonText()}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-0">
        <div className="p-2">
          <div className="text-sm font-medium mb-2">Select Metrics</div>
          {availableMetrics.map((metric) => {
            const isSelected = selectedMetrics.includes(metric.id);
            const isOnlySelected = isSelected && selectedMetrics.length === 1;

            return (
              <div
                key={metric.id}
                className={`flex items-center space-x-2 p-2 hover:bg-muted rounded-md cursor-pointer ${
                  isOnlySelected ? "opacity-50" : ""
                }`}
                onClick={() => handleMetricToggle(metric.id)}
                title={
                  isOnlySelected ? "At least one metric must be selected" : ""
                }
              >
                <Checkbox
                  checked={isSelected}
                  onChange={() => handleMetricToggle(metric.id)}
                  disabled={isOnlySelected}
                />
                <div className="flex items-center space-x-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: metric.color }}
                  />
                  <span className="text-sm">{metric.name}</span>
                </div>
              </div>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
