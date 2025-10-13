"use client";

import { Rubric, Scenario, Simulation } from "@/types";
import { ColumnDef } from "@tanstack/react-table";
import { useMemo } from "react";

export interface UseSimulationColumnsProps {
  scenarios: Scenario[];
  rubrics: Rubric[];
}

export function useSimulationColumns({
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
      // Note: scenarios column removed - scenarioIds is now in the simulation_scenarios
      // junction table and should be accessed via separate queries. Components using
      // this hook should fetch junction table data separately and handle filtering accordingly
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
    [scenarios, rubrics]
  );

  return { columns };
}
