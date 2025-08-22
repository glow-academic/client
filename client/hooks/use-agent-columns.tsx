"use client";

import { ColumnDef } from "@tanstack/react-table";
import { useMemo } from "react";

import { useModels } from "@/lib/api/hooks/models";
import { Agent, Model } from "@/types";

export function useAgentColumns() {
  const { data: models = [] } = useModels();

  // Create filter options
  const reasoningOptions = useMemo(
    () => [
      { value: "minimal", label: "Minimal" },
      { value: "low", label: "Low" },
      { value: "medium", label: "Medium" },
      { value: "high", label: "High" },
    ],
    []
  );

  const modelOptions = useMemo(() => {
    if (!models) return [];
    return models.map((model: Model) => ({
      value: model.id,
      label: model.name,
    }));
  }, [models]);

  const temperatureOptions = useMemo(
    () => [
      { value: "low", label: "Low (0.0-0.33)" },
      { value: "medium", label: "Medium (0.34-0.66)" },
      { value: "high", label: "High (0.67-1.0)" },
    ],
    []
  );

  // Helper function to get temperature range
  const getTemperatureRange = (temperature: number) => {
    if (temperature <= 0.33) return "low";
    if (temperature <= 0.66) return "medium";
    return "high";
  };

  // Create columns for the data table
  const columns: ColumnDef<Agent>[] = useMemo(
    () => [
      {
        accessorKey: "name",
        header: "Name",
        cell: ({ row }) => {
          const agent = row.original;
          return (
            <div className="font-medium">{agent.name || "Unnamed Agent"}</div>
          );
        },
      },
      {
        accessorKey: "description",
        header: "Description",
        cell: ({ row }) => {
          const agent = row.original;
          return (
            <div className="text-sm text-muted-foreground">
              {agent.description || "No description available"}
            </div>
          );
        },
      },
      {
        accessorKey: "reasoning",
        header: "Reasoning",
        cell: ({ row }) => {
          const agent = row.original;
          return (
            <div className="text-sm">
              {agent.reasoning ? (
                <span className="capitalize">{agent.reasoning}</span>
              ) : (
                <span className="text-muted-foreground">None</span>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: "temperature",
        header: "Temperature",
        cell: ({ row }) => {
          const agent = row.original;
          const temp = agent.temperature.toFixed(2);
          return <div className="text-sm">{temp}</div>;
        },
        filterFn: (row, id, value) => {
          const temperature = row.getValue(id) as number;
          const range = getTemperatureRange(temperature);
          return value.includes(range);
        },
      },
      {
        accessorKey: "modelId",
        header: "Model",
        cell: ({ row }) => {
          const agent = row.original;
          const model = models.find((m) => m.id === agent.modelId);
          return (
            <div className="text-sm">
              {model ? (
                model.name
              ) : (
                <span className="text-muted-foreground">No model</span>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: "updatedAt",
        header: "Updated",
        cell: ({ row }) => {
          const agent = row.original;
          return (
            <div className="text-sm text-muted-foreground">
              {new Date(agent.updatedAt).toLocaleDateString()}
            </div>
          );
        },
      },
    ],
    [models]
  );

  return {
    columns,
    reasoningOptions,
    modelOptions,
    temperatureOptions,
  };
}
