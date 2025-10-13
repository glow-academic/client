"use client";

import { ColumnDef } from "@tanstack/react-table";
import { useMemo } from "react";

import { useParameterItems } from "@/lib/api/hooks/parameter_items";
import { useScenariosByDepartmentIdBatch } from "@/lib/api/hooks/scenarios";
import { Parameter, ParameterItem, Scenario } from "@/types";
import { useDepartments } from "@/contexts/departments-context";

export function useParameterColumns() {
  const { effectiveDepartmentIds } = useDepartments();
  const { data: parameterItems = [] } = useParameterItems();
  const { data: scenarios = [] } = useScenariosByDepartmentIdBatch(
    effectiveDepartmentIds,
  );

  const columns = useMemo<ColumnDef<Parameter>[]>(
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
        accessorKey: "numerical",
        header: "Type",
        cell: ({ row }) => {
          const parameter = row.original;
          return parameter.numerical ? "Numerical" : "Text";
        },
        filterFn: (row, _, value) => {
          const parameter = row.original;
          const type = parameter.numerical ? "numerical" : "text";
          return value.includes(type);
        },
      },
      {
        accessorKey: "itemCount",
        header: "Items",
        cell: ({ row }) => {
          const parameter = row.original;
          const items = parameterItems.filter(
            (item: ParameterItem) => item.parameterId === parameter.id,
          );
          return items.length;
        },
        filterFn: (row, _, value) => {
          const parameter = row.original;
          const items = parameterItems.filter(
            (item: ParameterItem) => item.parameterId === parameter.id,
          );
          const count = items.length;

          // Convert count to range for filtering
          let range = "0";
          if (count === 0) range = "0";
          else if (count <= 3) range = "1-3";
          else if (count <= 6) range = "4-6";
          else range = "7+";

          return value.includes(range);
        },
      },
      {
        accessorKey: "active",
        header: "Status",
        cell: ({ row }) => {
          const parameter = row.original;
          return parameter.active ? "Active" : "Inactive";
        },
        filterFn: (row, _, value) => {
          const parameter = row.original;
          const status = parameter.active ? "active" : "inactive";
          return value.includes(status);
        },
      },
      {
        accessorKey: "scenarioIds",
        header: "Scenarios",
        cell: ({ row }) => {
          const parameter = row.original;
          const parameterItemIds = parameterItems
            .filter((item: ParameterItem) => item.parameterId === parameter.id)
            .map((item: ParameterItem) => item.id);

          const relatedScenarios = scenarios.filter((scenario: Scenario) =>
            scenario.parameterItemIds?.some((id: string) =>
              parameterItemIds.includes(id),
            ),
          );

          return relatedScenarios.map((scenario: Scenario) => scenario.id);
        },
        filterFn: (row, _, value) => {
          const parameter = row.original;
          const parameterItemIds = parameterItems
            .filter((item: ParameterItem) => item.parameterId === parameter.id)
            .map((item: ParameterItem) => item.id);

          const relatedScenarios = scenarios.filter((scenario: Scenario) =>
            scenario.parameterItemIds?.some((id: string) =>
              parameterItemIds.includes(id),
            ),
          );

          const scenarioIds = relatedScenarios.map(
            (scenario: Scenario) => scenario.id,
          );
          return value.some((filterValue: string) =>
            scenarioIds.includes(filterValue),
          );
        },
      },
      {
        accessorKey: "updatedAt",
        header: "Updated",
        cell: ({ row }) => row.getValue("updatedAt"),
      },
    ],
    [parameterItems, scenarios],
  );

  // Filter options
  const typeOptions = useMemo(
    () => [
      { value: "numerical", label: "Numerical" },
      { value: "text", label: "Text" },
    ],
    [],
  );

  const itemCountOptions = useMemo(
    () => [
      { value: "0", label: "0 items" },
      { value: "1-3", label: "1-3 items" },
      { value: "4-6", label: "4-6 items" },
      { value: "7+", label: "7+ items" },
    ],
    [],
  );

  const statusOptions = useMemo(
    () => [
      { value: "active", label: "Active" },
      { value: "inactive", label: "Inactive" },
    ],
    [],
  );

  const scenarioOptions = useMemo(
    () =>
      scenarios.map((scenario: Scenario) => ({
        value: scenario.id,
        label: scenario.name,
      })),
    [scenarios],
  );

  return {
    columns,
    typeOptions,
    itemCountOptions,
    statusOptions,
    scenarioOptions,
  };
}
