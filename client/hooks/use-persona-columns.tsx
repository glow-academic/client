"use client";

import { ColumnDef } from "@tanstack/react-table";
import { useMemo } from "react";

import { useDepartments } from "@/contexts/departments-context";
import { useModels } from "@/lib/api/v1/hooks/models";
import { useScenariosByDepartmentIdBatch } from "@/lib/api/v1/hooks/scenarios";
import { Model, Persona, Scenario } from "@/types";

export function usePersonaColumns() {
  const { effectiveDepartmentIds } = useDepartments();
  const { data: scenarios = [] } = useScenariosByDepartmentIdBatch(
    effectiveDepartmentIds
  );
  const { data: models = [] } = useModels();

  // Create filter options
  const scenarioOptions = useMemo(() => {
    if (!scenarios) return [];
    return scenarios.map((scenario: Scenario) => ({
      value: scenario.id,
      label: scenario.name,
    }));
  }, [scenarios]);

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
  const columns: ColumnDef<Persona>[] = useMemo(() => {
    // Note: scenario filtering removed - personaId is now in the scenario_personas
    // junction table and should be accessed via separate queries

    return [
      {
        accessorKey: "name",
        header: "Name",
        cell: ({ row }) => {
          const persona = row.original;
          return (
            <div className="font-medium">
              {persona.name || "Unnamed Persona"}
            </div>
          );
        },
      },
      {
        accessorKey: "description",
        header: "Description",
        cell: ({ row }) => {
          const persona = row.original;
          return (
            <div className="text-sm text-muted-foreground">
              {persona.description || "No description available"}
            </div>
          );
        },
      },
      // Note: scenarios column removed - personaId is now in scenario_personas junction table
      // and should be accessed via separate queries
      {
        accessorKey: "reasoning",
        header: "Reasoning",
        cell: ({ row }) => {
          const persona = row.original;
          return (
            <div className="text-sm">
              {persona.reasoning ? (
                <span className="capitalize">{persona.reasoning}</span>
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
          const persona = row.original;
          const temp = persona.temperature.toFixed(2);
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
          const persona = row.original;
          const model = models.find((m) => m.id === persona.modelId);
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
          const persona = row.original;
          return (
            <div className="text-sm text-muted-foreground">
              {new Date(persona.updatedAt).toLocaleDateString()}
            </div>
          );
        },
      },
    ];
  }, [models, scenarios]);

  return {
    columns,
    scenarioOptions,
    reasoningOptions,
    modelOptions,
    temperatureOptions,
  };
}
