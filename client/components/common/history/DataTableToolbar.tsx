"use client";

import { Table } from "@tanstack/react-table";
import { X } from "lucide-react";

import { DataTableViewOptions } from "@/components/common/history/DataTableViewOptions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { DataTableFacetedFilter } from "@/components/common/history/DataTableFacetedFilter";
import { SingleProfileBrightspaceExportButton } from "./SingleProfileBrightspaceExportButton";

export interface DataTableToolbarProps<TData> {
  table: Table<TData>;
  profileOptions: { value: string; label: string }[];
  simulationOptions: { value: string; label: string }[];
  scenarioOptions?: { value: string; label: string }[];
  isAdmin?: boolean;
  showExport?: boolean;
  showAll?: boolean;
}

export function DataTableToolbar<TData>({
  table,
  profileOptions,
  simulationOptions,
  scenarioOptions = [],
  isAdmin = false,
  showExport = true,
  showAll = false,
}: DataTableToolbarProps<TData>) {
  // Check if any filters are active
  const isFiltered = table.getState().columnFilters.length > 0;

  const profileIdColumn = showAll ? table.getColumn("profileId") : null;
  const simulationIdColumn = table.getColumn("simulationId");
  const scenariosColumn = table.getColumn("scenarios");

  return (
    <>
      <div className="flex items-center justify-between">
        <div className="flex flex-1 items-center space-x-2">
          <Input
            placeholder="Search by name, simulation, or scenarios..."
            value={
              (table.getColumn("simulationId")?.getFilterValue() as string) ??
              ""
            }
            onChange={(event) =>
              table
                .getColumn("simulationId")
                ?.setFilterValue(event.target.value)
            }
            className="h-8 w-[150px] lg:w-[250px]"
          />
          {/* Name filter - only show if profileId column exists and has options */}
          {profileIdColumn && profileOptions.length > 0 && (
            <DataTableFacetedFilter
              column={profileIdColumn}
              title="Name"
              options={profileOptions}
            />
          )}

          {/* Simulation filter */}
          {simulationIdColumn && simulationOptions.length > 0 && (
            <DataTableFacetedFilter
              column={simulationIdColumn}
              title="Simulation"
              options={simulationOptions}
            />
          )}

          {/* Scenarios filter */}
          {scenariosColumn && scenarioOptions.length > 0 && (
            <DataTableFacetedFilter
              column={scenariosColumn}
              title="Scenarios"
              options={scenarioOptions}
            />
          )}

          {isFiltered && (
            <Button
              variant="ghost"
              onClick={() => table.resetColumnFilters()}
              className="h-8 px-2 lg:px-3"
            >
              Reset
              <X className="ml-2 h-4 w-4" />
            </Button>
          )}
        </div>
        <div className="flex items-center space-x-2">
          {showExport && (
            <SingleProfileBrightspaceExportButton
              table={table}
              profileOptions={profileOptions}
            />
          )}

          <DataTableViewOptions table={table} isAdmin={isAdmin} />
        </div>
      </div>
    </>
  );
}
