"use client";

import { ColumnDef } from "@tanstack/react-table";
import { useMemo } from "react";

import { useDepartments } from "@/contexts/departments-context";
import { useProfilesByDepartmentIdBatch } from "@/lib/api/v1/hooks/profiles";
import { useSimulationsByDepartmentIdBatch } from "@/lib/api/v1/hooks/simulations";
import { Cohort, Profile, Simulation } from "@/types";

export function useCohortColumns() {
  const { effectiveDepartmentIds } = useDepartments();
  const { data: simulations = [] } = useSimulationsByDepartmentIdBatch(
    effectiveDepartmentIds
  );
  const { data: profiles = [] } = useProfilesByDepartmentIdBatch(
    effectiveDepartmentIds
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
      // Note: profileIds and simulationIds columns removed - these are now in junction tables
      // (cohort_profiles and cohort_simulations) and should be accessed via separate queries
      // Components using this hook should fetch junction table data separately and handle filtering accordingly
      {
        accessorKey: "updatedAt",
        header: "Updated",
        cell: ({ row }) => row.getValue("updatedAt"),
      },
    ],
    [simulations]
  );

  // Filter options
  const profileOptions = useMemo(
    () =>
      profiles.map((profile: Profile) => ({
        value: profile.id,
        label: `${profile.firstName} ${profile.lastName}`,
      })),
    [profiles]
  );

  const simulationOptions = useMemo(
    () =>
      simulations.map((simulation: Simulation) => ({
        value: simulation.id,
        label: simulation.title,
      })),
    [simulations]
  );

  return {
    columns,
    profileOptions,
    simulationOptions,
  };
}
