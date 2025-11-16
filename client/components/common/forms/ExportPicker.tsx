/**
 * ExportPicker.tsx
 * Multi-select metric picker for export functionality
 * Similar to PersonaPicker pattern
 */

"use client";

import { PopoverProps } from "@radix-ui/react-popover";
import {
  AlertCircle,
  Award,
  BarChart,
  Check,
  CheckCircle,
  ChevronsUpDown,
  Clock,
  MessageCircle,
  Target,
  Timer,
  TrendingUp,
  X,
} from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useMutationObserver } from "@/hooks/use-mutation-observer";
import { cn } from "@/lib/utils";

export type MetricOption = {
  value: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
};

const metricOptions: MetricOption[] = [
  {
    value: "highestScore",
    label: "Highest Score",
    description: "The highest score achieved across all attempts",
    icon: Target,
  },
  {
    value: "averageScore",
    label: "Average Score",
    description: "The mean score across all attempts",
    icon: BarChart,
  },
  {
    value: "completionPercentage",
    label: "Completion Percentage",
    description: "Percentage of simulations completed",
    icon: CheckCircle,
  },
  {
    value: "firstAttemptPassRate",
    label: "First Attempt Pass Rate",
    description: "Percentage of simulations passed on the first attempt",
    icon: Award,
  },
  {
    value: "messagesPerSession",
    label: "Messages Per Session",
    description: "Average number of messages exchanged per session",
    icon: MessageCircle,
  },
  {
    value: "personaResponseTimes",
    label: "Persona Response Times",
    description: "Average time for persona to respond",
    icon: Clock,
  },
  {
    value: "sessionEfficiency",
    label: "Session Efficiency",
    description: "Combined metric of score and time efficiency",
    icon: TrendingUp,
  },
  {
    value: "stagnationRate",
    label: "Stagnation Rate",
    description: "Percentage of sessions with no progress",
    icon: AlertCircle,
  },
  {
    value: "timeSpent",
    label: "Time Spent",
    description: "Average time spent per session",
    icon: Timer,
  },
  {
    value: "totalAttempts",
    label: "Total Attempts",
    description: "Total number of simulation attempts",
    icon: Target,
  },
];

export interface ExportPickerProps extends PopoverProps {
  selectedMetrics: string[];
  onSelect: (metrics: string[]) => void;
  label?: string;
  placeholder?: string;
  description?: string;
  disabled?: boolean;
}

export function ExportPicker({
  selectedMetrics,
  onSelect,
  label = "Metrics",
  placeholder = "Select metrics to export...",
  description = "Choose one or more metrics to include in the export.",
  disabled = false,
  ...props
}: ExportPickerProps) {
  const [open, setOpen] = React.useState(false);

  const [peekedMetric, setPeekedMetric] = React.useState<
    MetricOption | undefined
  >(undefined);

  const handleSelect = (metricValue: string) => {
    const isSelected = selectedMetrics.includes(metricValue);
    const newMetrics = isSelected
      ? selectedMetrics.filter((m) => m !== metricValue)
      : [...selectedMetrics, metricValue];
    onSelect(newMetrics);
  };

  // Allow clearing selection
  const handleClear = () => {
    onSelect([]);
    setOpen(false);
  };

  // Remove individual item in multi-select mode
  const handleRemoveItem = (metricValue: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newMetrics = selectedMetrics.filter((m) => m !== metricValue);
    onSelect(newMetrics);
  };

  const getButtonText = () => {
    if (selectedMetrics.length === 0) {
      return placeholder;
    }
    if (selectedMetrics.length === 1) {
      const metric = metricOptions.find((m) => m.value === selectedMetrics[0]);
      return metric?.label || placeholder;
    }
    return `${selectedMetrics.length} selected`;
  };

  // Get selected metric for displaying icon (first in multi-select)
  const selectedMetric = React.useMemo(() => {
    if (selectedMetrics.length === 0) return null;
    const firstValue = selectedMetrics[0];
    if (!firstValue) return null;
    return metricOptions.find((m) => m.value === firstValue) || null;
  }, [selectedMetrics]);

  const getSearchNotFoundMessage = () => {
    return `No ${label} found.`;
  };

  return (
    <div className="grid gap-2">
      <HoverCard openDelay={200}>
        <HoverCardTrigger asChild>
          <Label htmlFor="metrics">{label}</Label>
        </HoverCardTrigger>
        <HoverCardContent
          align="start"
          className="w-[260px] text-sm"
          side="left"
        >
          {description}
        </HoverCardContent>
      </HoverCard>

      {/* Show selected items in multi-select mode */}
      {selectedMetrics.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {selectedMetrics.map((value) => {
            const metric = metricOptions.find((m) => m.value === value);
            if (!metric) return null;
            const IconComponent = metric.icon;
            return (
              <div
                key={value}
                className="flex items-center gap-1 bg-secondary px-2 py-1 rounded-md text-sm"
              >
                <IconComponent className="h-3 w-3" />
                <span>{metric.label}</span>
                <button
                  type="button"
                  onClick={(e) => handleRemoveItem(value, e)}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <Popover
        open={disabled ? false : open}
        onOpenChange={disabled ? () => {} : setOpen}
        {...props}
      >
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-label="Select metrics"
            className="w-full justify-between"
            disabled={disabled}
          >
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {selectedMetric && (
                <div className="p-1 rounded-md shadow-sm flex-shrink-0 bg-primary/10">
                  <selectedMetric.icon className="h-3.5 w-3.5 text-primary" />
                </div>
              )}
              <span className="truncate">{getButtonText()}</span>
            </div>
            <ChevronsUpDown className="opacity-50 ml-2 flex-shrink-0" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-[300px] p-0">
          <HoverCard>
            <HoverCardContent
              side="left"
              align="start"
              forceMount
              className="min-h-[200px]"
            >
              <div className="grid gap-2">
                <h4 className="font-medium leading-none">
                  {peekedMetric?.label || "No metric selected"}
                </h4>
                <div className="text-sm text-muted-foreground">
                  {peekedMetric?.description || "No description available"}
                </div>
              </div>
            </HoverCardContent>
            <Command loop>
              <CommandList className="h-[var(--cmdk-list-height)] max-h-[400px]">
                <CommandInput placeholder="Search metrics..." />
                <CommandEmpty>{getSearchNotFoundMessage()}</CommandEmpty>
                <HoverCardTrigger />
                {selectedMetrics.length > 0 && (
                  <CommandGroup heading="Actions">
                    <CommandItem
                      onSelect={handleClear}
                      className="text-muted-foreground"
                    >
                      Clear All
                    </CommandItem>
                  </CommandGroup>
                )}
                <CommandGroup heading="Metrics">
                  {metricOptions.map((metric) => (
                    <MetricItem
                      key={metric.value}
                      metric={metric}
                      isSelected={selectedMetrics.includes(metric.value)}
                      onPeek={setPeekedMetric}
                      onSelect={() => handleSelect(metric.value)}
                    />
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </HoverCard>
        </PopoverContent>
      </Popover>
    </div>
  );
}

interface MetricItemProps {
  metric: MetricOption;
  isSelected: boolean;
  onSelect: () => void;
  onPeek: (metric: MetricOption) => void;
}

function MetricItem({ metric, isSelected, onSelect, onPeek }: MetricItemProps) {
  const ref = React.useRef<HTMLDivElement>(null);
  const IconComponent = metric.icon;

  useMutationObserver(ref, (mutations) => {
    mutations.forEach((mutation) => {
      if (
        mutation.type === "attributes" &&
        mutation.attributeName === "aria-selected" &&
        ref.current?.getAttribute("aria-selected") === "true"
      ) {
        onPeek(metric);
      }
    });
  });

  return (
    <CommandItem
      key={metric.value}
      onSelect={onSelect}
      ref={ref}
      className="group data-[selected=true]:bg-primary data-[selected=true]:text-primary-foreground"
    >
      <div className="flex items-center gap-3 w-full">
        <div className="p-2 rounded-lg shadow-sm flex-shrink-0 bg-primary/10 border border-transparent group-data-[selected=true]:bg-primary/20 group-data-[selected=true]:border-primary-foreground">
          <IconComponent className="h-4 w-4 text-primary group-data-[selected=true]:text-primary-foreground stroke-current" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-medium truncate">{metric.label}</div>
          {metric.description && (
            <div className="text-sm text-muted-foreground truncate group-data-[selected=true]:text-primary-foreground/80">
              {metric.description}
            </div>
          )}
        </div>
        <Check
          className={cn(
            "ml-auto stroke-current",
            isSelected ? "opacity-100" : "opacity-0"
          )}
        />
      </div>
    </CommandItem>
  );
}
