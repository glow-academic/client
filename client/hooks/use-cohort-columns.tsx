"use client";

import { useQuery } from "@tanstack/react-query";
import { ColumnDef } from "@tanstack/react-table";
import { useMemo } from "react";

import { Class, Cohort, Profile, Simulation } from "@/types";
import { getAllClasses } from "@/utils/queries/classes/get-all-classes";
import { getAllProfiles } from "@/utils/queries/profiles/get-all-profiles";
import { getAllSimulations } from "@/utils/queries/simulations/get-all-simulations";

export function useCohortColumns() {
  // Fetch data for filter options
  const { data: simulations = [] } = useQuery({
    queryKey: ["simulations"],
    queryFn: () => getAllSimulations(),
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles"],
    queryFn: () => getAllProfiles(),
  });

  const { data: classes = [] } = useQuery({
    queryKey: ["classes"],
    queryFn: () => getAllClasses(),
  });

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
            cohortProfileIds.includes(filterValue)
          );
        },
      },
      {
        accessorKey: "simulationIds",
        header: "Simulations",
        cell: ({ row }) => {
          const cohort = row.original;
          const cohortSimulations = simulations.filter((sim: Simulation) =>
            sim.cohortIds.includes(cohort.id)
          );
          return cohortSimulations.map((sim: Simulation) => sim.id);
        },
        filterFn: (row, _, value) => {
          const cohort = row.original;
          const cohortSimulations = simulations.filter((sim: Simulation) =>
            sim.cohortIds.includes(cohort.id)
          );
          const simulationIds = cohortSimulations.map(
            (sim: Simulation) => sim.id
          );
          return value.some((filterValue: string) =>
            simulationIds.includes(filterValue)
          );
        },
      },
      {
        accessorKey: "classIds",
        header: "Classes",
        cell: ({ row }) => {
          const cohort = row.original;
          const cohortProfileIds = cohort.profileIds || [];
          // Find classes that have any of the cohort's profiles assigned
          const classIds = classes
            .filter((cls: Class) =>
              cls.profileIds?.some((profileId: string) =>
                cohortProfileIds.includes(profileId)
              )
            )
            .map((cls: Class) => cls.id);
          return [...new Set(classIds)]; // Remove duplicates
        },
        filterFn: (row, _, value) => {
          const cohort = row.original;
          const cohortProfileIds = cohort.profileIds || [];
          // Find classes that have any of the cohort's profiles assigned
          const classIds = classes
            .filter((cls: Class) =>
              cls.profileIds?.some((profileId: string) =>
                cohortProfileIds.includes(profileId)
              )
            )
            .map((cls: Class) => cls.id);
          return value.some((filterValue: string) =>
            classIds.includes(filterValue)
          );
        },
      },
      {
        accessorKey: "updatedAt",
        header: "Updated",
        cell: ({ row }) => row.getValue("updatedAt"),
      },
    ],
    [simulations, classes]
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

  const classOptions = useMemo(
    () =>
      classes.map((cls: Class) => ({
        value: cls.id,
        label: cls.name,
      })),
    [classes]
  );

  return {
    columns,
    profileOptions,
    simulationOptions,
    classOptions,
  };
}
