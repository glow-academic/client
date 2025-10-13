"use client";

import { ColumnDef } from "@tanstack/react-table";
import { useMemo } from "react";

import { useDepartments } from "@/contexts/departments-context";
import { useCohortsByDepartmentIdBatch } from "@/lib/api/v1/hooks/cohorts";
import { usePersonasByDepartmentIdBatch } from "@/lib/api/v1/hooks/personas";
import { useSimulationsByDepartmentIdBatch } from "@/lib/api/v1/hooks/simulations";
import { Cohort, Persona, Scenario, Simulation } from "@/types";

export function useScenarioColumns() {
  const { effectiveDepartmentIds } = useDepartments();
  const { data: simulations = [] } = useSimulationsByDepartmentIdBatch(
    effectiveDepartmentIds
  );
  const { data: cohorts = [] } = useCohortsByDepartmentIdBatch(
    effectiveDepartmentIds
  );
  const { data: personas = [] } = usePersonasByDepartmentIdBatch(
    effectiveDepartmentIds
  );

  const columns = useMemo<ColumnDef<Scenario>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Name",
        cell: ({ row }) => row.getValue("name"),
        filterFn: (row, id, value) => {
          const name = row.getValue(id) as string;
          const problemStatement = row.original.problemStatement || "";

          const searchText = value.toLowerCase();
          return (
            name.toLowerCase().includes(searchText) ||
            problemStatement.toLowerCase().includes(searchText)
          );
        },
      },
      // Note: simulationIds, cohortIds, and personaId columns removed
      // These are now in junction tables (simulation_scenarios, scenario_personas)
      // and should be accessed via separate queries. Components using this hook
      // should fetch junction table data separately and handle filtering accordingly
      {
        accessorKey: "updatedAt",
        header: "Updated",
        cell: ({ row }) => row.getValue("updatedAt"),
      },
    ],
    [simulations, cohorts]
  );

  // Filter options
  const simulationOptions = useMemo(
    () =>
      simulations.map((simulation: Simulation) => ({
        value: simulation.id,
        label: simulation.title,
      })),
    [simulations]
  );

  const cohortOptions = useMemo(
    () =>
      cohorts.map((cohort: Cohort) => ({
        value: cohort.id,
        label: cohort.title,
      })),
    [cohorts]
  );

  const personaOptions = useMemo(
    () =>
      personas.map((persona: Persona) => ({
        value: persona.id,
        label: persona.name,
      })),
    [personas]
  );

  return {
    columns,
    simulationOptions,
    cohortOptions,
    personaOptions,
  };
}
