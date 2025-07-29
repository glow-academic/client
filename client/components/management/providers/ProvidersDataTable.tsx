"use client";

import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import * as React from "react";

import { DataTablePagination } from "@/components/common/history/DataTablePagination";
import { Model, Provider } from "@/types";
import { ProvidersDataTableToolbar } from "./ProvidersDataTableToolbar";

export interface ProvidersDataTableProps {
  columns: ColumnDef<Model>[];
  data: Model[];
  providers: Provider[];
  providerOptions: { value: string; label: string }[];
  customModelOptions: { value: string; label: string }[];
  statusOptions: { value: string; label: string }[];
  renderProviderGroup: (providerGroup: {
    provider: Provider;
    models: Model[];
  }) => React.ReactNode;
}

export function ProvidersDataTable({
  columns,
  data,
  providers,
  providerOptions,
  customModelOptions,
  statusOptions,
  renderProviderGroup,
}: ProvidersDataTableProps) {
  const [rowSelection, setRowSelection] = React.useState({});
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({});
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    [],
  );
  const [sorting, setSorting] = React.useState<SortingState>([
    { id: "updatedAt", desc: true }, // Default to descending order by date
  ]);

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnVisibility,
      rowSelection,
      columnFilters,
    },
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    initialState: {
      pagination: {
        pageSize: 10,
      },
    },
  });

  // Group the filtered models by provider
  const filteredRows = table.getFilteredRowModel().rows;
  const providerGroups = React.useMemo(() => {
    // Get the filtered models from the table
    const filteredModels = filteredRows.map((row) => row.original);

    return providers
      .map((provider: Provider) => ({
        provider,
        models: filteredModels.filter(
          (model: Model) => model.providerId === provider.id,
        ),
      }))
      .filter((group) => group.models.length > 0);
  }, [providers, filteredRows]);

  return (
    <div className="space-y-4">
      <ProvidersDataTableToolbar
        table={table}
        providerOptions={providerOptions}
        customModelOptions={customModelOptions}
        statusOptions={statusOptions}
      />

      {providerGroups.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          No models match the current filters.
        </div>
      ) : (
        <div className="space-y-6">
          {providerGroups.map((group) => renderProviderGroup(group))}
        </div>
      )}

      <DataTablePagination table={table} />
    </div>
  );
}
