/**
 * SimulationPerformance.tsx
 * This component displays scenario performance within a selected simulation.
 * @AshokSaravanan222 & @siladiea
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
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { ScenarioFact } from "@/lib/analytics";
import { cn } from "@/lib/utils";
import { BarChart3, Check, ChevronsUpDown } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type SimulationLite = { id: string; title: string; scenarioIds?: string[] };

export interface SimulationPerformanceProps {
  validSimulationIds: string[];
  scenarioFacts: ScenarioFact[];
  allSimulations: SimulationLite[]; // from client cache
  isLoading: boolean;
  isError: boolean;
  actionableInsight?: string | null;
  thresholds: {
    danger: number;
    warning: number;
    success: number;
  };
}

export default function SimulationPerformance({
  validSimulationIds,
  scenarioFacts,
  allSimulations,
  isLoading,
  isError,
  actionableInsight,
  thresholds,
}: SimulationPerformanceProps) {
  const [selectedSimulationId, setSelectedSimulationId] = useState<string>("");

  const pickerOptions = useMemo(
    () => allSimulations.filter((s) => validSimulationIds.includes(s.id)),
    [allSimulations, validSimulationIds]
  );

  useEffect(() => {
    if (!selectedSimulationId && pickerOptions[0]) {
      setSelectedSimulationId(pickerOptions[0].id);
    } else if (
      selectedSimulationId &&
      !pickerOptions.some((s) => s.id === selectedSimulationId)
    ) {
      setSelectedSimulationId(pickerOptions[0]?.id || "");
    }
  }, [pickerOptions, selectedSimulationId]);

  const data = useMemo(
    () =>
      scenarioFacts
        .filter((f) => f.simulationId === selectedSimulationId)
        .sort((a, b) => a.scenarioName.localeCompare(b.scenarioName)),
    [scenarioFacts, selectedSimulationId]
  );

  const status = useMemo(() => {
    if (!data.length) return "neutral";
    const avgScore = data.reduce((s, d) => s + d.avgScore, 0) / data.length;
    const avgSucc = data.reduce((s, d) => s + d.successRate, 0) / data.length;
    const combined = 0.7 * avgScore + 0.3 * avgSucc;
    if (combined >= thresholds.success) return "success";
    if (combined >= thresholds.warning) return "warning";
    return "danger";
  }, [data, thresholds]);

  if (isLoading) {
    return (
      <Card className="w-full h-full flex flex-col">
        <CardHeader>
          <CardTitle>Simulation Performance</CardTitle>
          <CardDescription>Loading simulation data...</CardDescription>
        </CardHeader>
        <CardContent className="flex-1 flex items-center justify-center text-muted-foreground">
          Loading...
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card className="w-full h-full flex flex-col">
        <CardHeader>
          <CardTitle>Simulation Performance</CardTitle>
          <CardDescription>Error loading data</CardDescription>
        </CardHeader>
        <CardContent className="flex-1 flex items-center justify-center text-destructive">
          Failed to load simulation data
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full h-full flex flex-col relative">
      <div
        className={`absolute top-2 right-2 w-2 h-2 rounded-full ${
          status === "success"
            ? "bg-green-500"
            : status === "warning"
              ? "bg-yellow-500"
              : status === "danger"
                ? "bg-red-500"
                : "bg-gray-400"
        }`}
      />
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Simulation Performance
            </CardTitle>
            <CardDescription className="text-sm">
              Performance trends for scenarios within simulations
            </CardDescription>
          </div>

          <SimPicker
            options={pickerOptions}
            value={selectedSimulationId}
            onChange={setSelectedSimulationId}
          />
        </div>
      </CardHeader>

      <CardContent className="space-y-4 flex-1 flex flex-col">
        <div className="flex-1 min-h-[180px] h-[180px] mb-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              margin={{ top: 10, right: 10, bottom: 30, left: 10 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="scenarioName"
                fontSize={10}
                height={40}
                angle={-45}
                textAnchor="end"
                tickFormatter={(name: string) =>
                  name.length > 12 ? name.slice(0, 11) + "…" : name
                }
              />
              <YAxis domain={[0, 100]} fontSize={10} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--background))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "6px",
                  color: "#000000",
                }}
                labelStyle={{ color: "#000000" }}
                formatter={(value: number, name: string) => [
                  `${value}%`,
                  name === "avgScore" ? "Average Score" : "Success Rate",
                ]}
              />
              <Bar
                dataKey="avgScore"
                fill="#3b82f6"
                name="Average Score"
                radius={[2, 2, 0, 0]}
              />
              <Bar
                dataKey="successRate"
                fill="#10b981"
                name="Success Rate"
                radius={[2, 2, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-4 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded bg-blue-500" />
            <span>Average Score</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded bg-green-500" />
            <span>Success Rate</span>
          </div>
        </div>

        {/* Actionable Insights */}
        {actionableInsight && (
          <div className="p-3 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground leading-relaxed">
              {actionableInsight}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SimPicker({
  options,
  value,
  onChange,
}: {
  options: { id: string; title: string }[];
  value: string;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.id === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-64 justify-between text-sm h-8"
        >
          <span className="truncate text-left">
            {selected ? selected.title : "Select simulation..."}
          </span>
          <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0">
        <Command>
          <CommandInput placeholder="Search simulations..." />
          <CommandEmpty>No simulation found.</CommandEmpty>
          <CommandGroup>
            {options.map((s) => (
              <CommandItem
                key={s.id}
                value={s.id}
                onSelect={() => {
                  onChange(s.id);
                  setOpen(false);
                }}
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4 shrink-0",
                    value === s.id ? "opacity-100" : "opacity-0"
                  )}
                />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{s.title}</div>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
