"use client";

import { ColumnDef } from "@tanstack/react-table";
import { useMemo } from "react";

import { Cohort, Profile, Simulation } from "@/types";
import { useSimulationsByDepartmentIdBatch } from "@/lib/api/hooks/simulations";
import { useProfilesByDepartmentIdBatch } from "@/lib/api/hooks/profiles";
import { useDepartments } from "@/contexts/departments-context";

export function useCohortColumns() {
  const { effectiveDepartmentIds } = useDepartments();
  const { data: simulations = [] } = useSimulationsByDepartmentIdBatch(
    effectiveDepartmentIds,
  );
  const { data: profiles = [] } = useProfilesByDepartmentIdBatch(
    effectiveDepartmentIds,
  );

  const columns = useMemo<ColumnDef<Cohort>[]>(
    () => [
      {
        accessorKey: "title",
        header: "Title",
        cell: ({ row }) => row.getValue("title"),
        filterFn: (row, id, value) => {
          const title = row.getValue(id) as string;
          const description = row.original.description || "";

          const searchText = value.toLowerCase();
          return (
            title.toLowerCase().includes(searchText) ||
            description.toLowerCase().includes(searchText)
          );
        },
      },
      {
        accessorKey: "profileIds",
        header: "Profiles",
        cell: ({ row }) => {
          const cohort = row.original;
          return cohort.profileIds || [];
        },
        filterFn: (row, _, value) => {
          const cohort = row.original;
          const cohortProfileIds = cohort.profileIds || [];
          return value.some((filterValue: string) =>
            cohortProfileIds.includes(filterValue),
          );
        },
      },
      {
        accessorKey: "simulationIds",
        header: "Simulations",
        cell: ({ row }) => {
          const cohort = row.original;
          const cohortSimulations = simulations.filter((sim: Simulation) =>
            cohort.simulationIds.includes(sim.id),
          );
          return cohortSimulations.map((sim: Simulation) => sim.id);
        },
        filterFn: (row, _, value) => {
          const cohort = row.original;
          const cohortSimulations = simulations.filter((sim: Simulation) =>
            cohort.simulationIds.includes(sim.id),
          );
          const simulationIds = cohortSimulations.map(
            (sim: Simulation) => sim.id,
          );
          return value.some((filterValue: string) =>
            simulationIds.includes(filterValue),
          );
        },
      },
      {
        accessorKey: "updatedAt",
        header: "Updated",
        cell: ({ row }) => row.getValue("updatedAt"),
      },
    ],
    [simulations],
  );

  // Filter options
  const profileOptions = useMemo(
    () =>
      profiles.map((profile: Profile) => ({
        value: profile.id,
        label: `${profile.firstName} ${profile.lastName}`,
      })),
    [profiles],
  );

  const simulationOptions = useMemo(
    () =>
      simulations.map((simulation: Simulation) => ({
        value: simulation.id,
        label: simulation.title,
      })),
    [simulations],
  );

  return {
    columns,
    profileOptions,
    simulationOptions,
  };
}
