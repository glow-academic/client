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
import {
  CohortItem,
  ProfileMapping,
  SimulationMapping,
} from "@/lib/api/v2/schemas/cohorts";
import { CohortsDataTableToolbar } from "./CohortsDataTableToolbar";

export interface CohortsDataTableProps {
  data: CohortItem[];
  profileMapping: ProfileMapping;
  simulationMapping: SimulationMapping;
  profileOptions: { value: string; label: string }[];
  simulationOptions: { value: string; label: string }[];
  renderCohortCard: (cohort: CohortItem) => React.ReactNode;
}

export function CohortsDataTable({
  data,
  profileMapping: _profileMapping,
  simulationMapping: _simulationMapping,
  profileOptions,
  simulationOptions,
  renderCohortCard,
}: CohortsDataTableProps) {
  // Minimal columns for filtering/sorting only (card view, no table)
  const columns: ColumnDef<CohortItem>[] = React.useMemo(
    () => [
      {
        accessorKey: "name",
        header: "Name",
      },
      {
        accessorKey: "profile_ids",
        header: "Profiles",
      },
      {
        accessorKey: "simulation_ids",
        header: "Simulations",
      },
    ],
    []
  );
  const [rowSelection, setRowSelection] = React.useState({});
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({});
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    []
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
        pageSize: 12,
      },
    },
  });

  return (
    <div className="space-y-4">
      <CohortsDataTableToolbar
        table={table}
        profileOptions={profileOptions}
        simulationOptions={simulationOptions}
      />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {table.getRowModel().rows.length ? (
          table.getRowModel().rows.map((row) => renderCohortCard(row.original))
        ) : (
          <div className="col-span-full text-center py-8 text-muted-foreground">
            No cohorts match the current filters.
          </div>
        )}
      </div>
      <DataTablePagination table={table} card={true} />
    </div>
  );
}
