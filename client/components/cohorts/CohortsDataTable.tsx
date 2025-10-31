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
} from "@/lib/api/v2/schemas/cohorts";
import { CohortsDataTableToolbar } from "./CohortsDataTableToolbar";
import { ProfileMapping, SimulationMapping } from "@/lib/api/v2/schemas/base";

export interface CohortsDataTableProps {
  data: CohortItem[];
  profileMapping: ProfileMapping;
  simulationMapping: SimulationMapping;
  profileOptions: { value: string; label: string }[];
  simulationOptions: { value: string; label: string }[];
  departmentOptions?: { value: string; label: string }[];
  renderCohortCard: (cohort: CohortItem) => React.ReactNode;
}

export function CohortsDataTable({
  data,
  profileMapping: _profileMapping,
  simulationMapping: _simulationMapping,
  profileOptions,
  simulationOptions,
  departmentOptions = [],
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
      // Hidden faceting column for Departments (array of IDs)
      {
        id: "departments",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        accessorFn: (row: CohortItem) => row.department_ids ?? [],
        filterFn: (row, _id, value: string[]) => {
          const rowIds = (row.getValue("departments") as string[]) ?? [];
          if (value.length === 0) return true;
          if (rowIds.length === 0) return true; // Show cross-department items when no filter
          return value.some((v) => rowIds.includes(v));
        },
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
        departmentOptions={departmentOptions}
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
