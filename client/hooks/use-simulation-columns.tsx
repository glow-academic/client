"use client";

import { Cohort, Rubric, Scenario, Simulation } from "@/types";
import { ColumnDef } from "@tanstack/react-table";
import { useMemo } from "react";

export interface UseSimulationColumnsProps {
  cohorts: Cohort[];
  scenarios: Scenario[];
  rubrics: Rubric[];
}

export function useSimulationColumns({
  cohorts,
  scenarios,
  rubrics,
}: UseSimulationColumnsProps) {
  const columns = useMemo<ColumnDef<Simulation>[]>(
    () => [
      {
        accessorKey: "title",
        header: "Title",
        cell: ({ row }) => row.getValue("title"),
        filterFn: (row, _, value) => {
          const title = (row.getValue("title") as string).toLowerCase();
          return title.includes(value.toLowerCase());
        },
      },
      {
        id: "cohorts",
        header: "Cohorts",
        accessorFn: (simulation) => {
          const simulationCohorts = cohorts.filter((cohort: Cohort) =>
            simulation.cohortIds?.includes(cohort.id)
          );
          return simulationCohorts.map((cohort: Cohort) => cohort.id);
        },
        filterFn: (row, _, value) => {
          const simulation = row.original;
          const simulationCohortIds = simulation.cohortIds || [];
          return value.some((filterValue: string) =>
            simulationCohortIds.includes(filterValue)
          );
        },
      },
      {
        id: "scenarios",
        header: "Scenarios",
        accessorFn: (simulation) => {
          const simulationScenarios = scenarios.filter((scenario: Scenario) =>
            simulation.scenarioIds?.includes(scenario.id)
          );
          return simulationScenarios.map((scenario: Scenario) => scenario.id);
        },
        filterFn: (row, _, value) => {
          const simulation = row.original;
          const simulationScenarioIds = simulation.scenarioIds || [];
          return value.some((filterValue: string) =>
            simulationScenarioIds.includes(filterValue)
          );
        },
      },
      {
        id: "rubric",
        header: "Rubric",
        accessorFn: (simulation) => {
          const simulationRubric = rubrics.find(
            (rubric: Rubric) => rubric.id === simulation.rubricId
          );
          return simulationRubric?.id || "";
        },
        filterFn: (row, _, value) => {
          const simulation = row.original;
          return value.includes(simulation.rubricId);
        },
      },
      {
        id: "timeLimit",
        header: "Time Limit",
        accessorFn: (simulation) => simulation.timeLimit || 0,
        filterFn: (row, _, value) => {
          const simulation = row.original;
          const timeLimit = simulation.timeLimit || 0;

          // Value is an array of time ranges: ["no-limit", "0-30", "30-60", "60-120", "120+"]
          return value.some((range: string) => {
            switch (range) {
              case "no-limit":
                return timeLimit === 0 || timeLimit === null;
              case "0-30":
                return timeLimit > 0 && timeLimit <= 30;
              case "30-60":
                return timeLimit > 30 && timeLimit <= 60;
              case "60-120":
                return timeLimit > 60 && timeLimit <= 120;
              case "120+":
                return timeLimit > 120;
              default:
                return false;
            }
          });
        },
      },
      {
        accessorKey: "updatedAt",
        header: "Updated At",
        cell: ({ row }) => row.getValue("updatedAt"),
      },
    ],
    [cohorts, scenarios, rubrics]
  );

  return { columns };
}
