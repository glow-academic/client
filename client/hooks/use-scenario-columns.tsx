"use client";

import { ColumnDef } from "@tanstack/react-table";
import { useMemo } from "react";

import { Cohort, Persona, Scenario, Simulation } from "@/types";
import { useSimulations } from "@/lib/api/hooks/simulations";
import { useCohorts } from "@/lib/api/hooks/cohorts";
import { usePersonas } from "@/lib/api/hooks/personas";

export function useScenarioColumns() {

  const { data: simulations = [] } = useSimulations();
  const { data: cohorts = [] } = useCohorts();
  const { data: personas = [] } = usePersonas();

  const columns = useMemo<ColumnDef<Scenario>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Name",
        cell: ({ row }) => row.getValue("name"),
        filterFn: (row, id, value) => {
          const name = row.getValue(id) as string;
          const description = row.original.description || "";

          const searchText = value.toLowerCase();
          return (
            name.toLowerCase().includes(searchText) ||
            description.toLowerCase().includes(searchText)
          );
        },
      },
      {
        accessorKey: "simulationIds",
        header: "Simulations",
        cell: ({ row }) => {
          const scenario = row.original;
          const scenarioSimulations = simulations.filter((sim: Simulation) =>
            sim.scenarioIds.includes(scenario.id)
          );
          return scenarioSimulations.map((sim: Simulation) => sim.id);
        },
        filterFn: (row, _, value) => {
          const scenario = row.original;
          const scenarioSimulations = simulations.filter((sim: Simulation) =>
            sim.scenarioIds.includes(scenario.id)
          );
          const simulationIds = scenarioSimulations.map(
            (sim: Simulation) => sim.id
          );
          return value.some((filterValue: string) =>
            simulationIds.includes(filterValue)
          );
        },
      },
      {
        accessorKey: "cohortIds",
        header: "Cohorts",
        cell: ({ row }) => {
          const scenario = row.original;
          // Find all simulation IDs for this scenario
          const scenarioSimulationIds = simulations
            .filter((sim: Simulation) => sim.scenarioIds.includes(scenario.id))
            .map((sim: Simulation) => sim.id);

          // Find all cohorts whose simulation_ids include any of the scenario's simulation IDs
          const relatedCohorts = cohorts.filter(
            (cohort: Cohort) =>
              Array.isArray(cohort.simulationIds) &&
              cohort.simulationIds.some((simId: string) =>
                scenarioSimulationIds.includes(simId)
              )
          );

          // Return unique cohort IDs
          return [
            ...new Set(relatedCohorts.map((cohort: Cohort) => cohort.id)),
          ];
        },
        filterFn: (row, _, value) => {
          const scenario = row.original;
          const scenarioSimulations = simulations.filter((sim: Simulation) =>
            sim.scenarioIds.includes(scenario.id)
          );
          const scenarioSimulationIds = scenarioSimulations.map(
            (sim: Simulation) => sim.id
          );

          // Find all cohorts whose simulation_ids include any of the scenario's simulation IDs
          const relatedCohorts = cohorts.filter(
            (cohort: Cohort) =>
              Array.isArray(cohort.simulationIds) &&
              cohort.simulationIds.some((simId: string) =>
                scenarioSimulationIds.includes(simId)
              )
          );

          // Return unique cohort IDs
          return value.some((filterValue: string) =>
            relatedCohorts
              .map((cohort: Cohort) => cohort.id)
              .includes(filterValue)
          );
        },
      },
      {
        accessorKey: "personaId",
        header: "Persona",
        cell: ({ row }) => row.getValue("personaId"),
        filterFn: (row, id, value) => {
          const personaId = row.getValue(id) as string;
          return value.includes(personaId);
        },
      },
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
