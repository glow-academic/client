"use client";

import { useQuery } from "@tanstack/react-query";
import { ColumnDef } from "@tanstack/react-table";
import { useMemo } from "react";

import { Model, Persona, Scenario } from "@/types";
import { getAllModels } from "@/utils/queries/models/get-all-models";
import { getAllScenarios } from "@/utils/queries/scenarios/get-all-scenarios";

export function usePersonaColumns() {
  // Fetch data for filter options
  const { data: scenarios = [] } = useQuery({
    queryKey: ["scenarios"],
    queryFn: () => getAllScenarios(),
  });

  const { data: models = [] } = useQuery({
    queryKey: ["models"],
    queryFn: () => getAllModels(),
  });

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
    // Helper function to get scenarios for a persona
    const getScenariosForPersona = (personaId: string) => {
      return scenarios.filter((scenario) => scenario.personaId === personaId);
    };

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
      {
        accessorKey: "scenarios",
        header: "Scenarios",
        cell: ({ row }) => {
          const persona = row.original;
          const personaScenarios = getScenariosForPersona(persona.id);
          return (
            <div className="text-sm">
              {personaScenarios.length > 0 ? (
                <span className="text-muted-foreground">
                  {personaScenarios.length} scenario
                  {personaScenarios.length !== 1 ? "s" : ""}
                </span>
              ) : (
                <span className="text-muted-foreground">No scenarios</span>
              )}
            </div>
          );
        },
        filterFn: (row, _, value) => {
          const persona = row.original;
          const personaScenarios = getScenariosForPersona(persona.id);
          return value.some((scenarioId: string) =>
            personaScenarios.some((scenario) => scenario.id === scenarioId)
          );
        },
      },
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
