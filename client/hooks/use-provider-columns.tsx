"use client";

import { useQuery } from "@tanstack/react-query";
import { ColumnDef } from "@tanstack/react-table";
import { useMemo } from "react";

import { Model, Provider } from "@/types";
import { getAllProviders } from "@/utils/queries/providers/get-all-providers";

export function useProviderColumns() {
  // Fetch data for filter options
  const { data: providers = [] } = useQuery({
    queryKey: ["providers"],
    queryFn: () => getAllProviders(),
  });

  const columns = useMemo<ColumnDef<Model>[]>(
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
        accessorKey: "providerId",
        header: "Provider",
        cell: ({ row }) => {
          const model = row.original;
          const provider = providers.find(
            (p: Provider) => p.id === model.providerId
          );
          return provider?.name || "Unknown Provider";
        },
        filterFn: (row, _, value) => {
          const model = row.original;
          return value.some(
            (filterValue: string) => model.providerId === filterValue
          );
        },
      },
      {
        id: "isCustom",
        header: "Custom Model",
        accessorFn: (row) => {
          const provider = providers.find(
            (p: Provider) => p.id === row.providerId
          );
          return provider?.baseUrl ? "Custom" : "Standard";
        },
        cell: ({ row }) => {
          const model = row.original;
          const provider = providers.find(
            (p: Provider) => p.id === model.providerId
          );
          return provider?.baseUrl ? "Custom" : "Standard";
        },
        filterFn: (row, _, value) => {
          const model = row.original;
          const provider = providers.find(
            (p: Provider) => p.id === model.providerId
          );
          const isCustom = provider?.baseUrl ? "Custom" : "Standard";
          return value.some((filterValue: string) => isCustom === filterValue);
        },
      },
      {
        accessorKey: "active",
        header: "Status",
        cell: ({ row }) => {
          const active = row.getValue("active") as boolean;
          return active ? "Active" : "Inactive";
        },
        filterFn: (row, _, value) => {
          const model = row.original;
          const status = model.active ? "Active" : "Inactive";
          return value.some((filterValue: string) => status === filterValue);
        },
      },
      {
        accessorKey: "updatedAt",
        header: "Updated",
        cell: ({ row }) => row.getValue("updatedAt"),
      },
    ],
    [providers]
  );

  // Filter options
  const providerOptions = useMemo(
    () =>
      providers.map((provider: Provider) => ({
        value: provider.id,
        label: provider.name,
      })),
    [providers]
  );

  const customModelOptions = useMemo(
    () => [
      { value: "Custom", label: "Custom Models" },
      { value: "Standard", label: "Standard Models" },
    ],
    []
  );

  const statusOptions = useMemo(
    () => [
      { value: "Active", label: "Active" },
      { value: "Inactive", label: "Inactive" },
    ],
    []
  );

  return {
    columns,
    providerOptions,
    customModelOptions,
    statusOptions,
  };
}
