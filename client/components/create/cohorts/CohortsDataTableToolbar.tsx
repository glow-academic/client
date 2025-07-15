"use client";

import { Table } from "@tanstack/react-table";
import { X } from "lucide-react";

import { DataTableFacetedFilter } from "@/components/common/history/DataTableFacetedFilter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Cohort } from "@/types";

export interface CohortsDataTableToolbarProps {
  table: Table<Cohort>;
  profileOptions: { value: string; label: string }[];
  simulationOptions: { value: string; label: string }[];
  classOptions: { value: string; label: string }[];
}

export function CohortsDataTableToolbar({
  table,
  profileOptions,
  simulationOptions,
  classOptions,
}: CohortsDataTableToolbarProps) {
  // Check if any filters are active
  const isFiltered = table.getState().columnFilters.length > 0;

  const titleColumn = table.getColumn("title");
  const profileColumn = table.getColumn("profileIds");
  const simulationColumn = table.getColumn("simulationIds");
  const classColumn = table.getColumn("classIds");

  return (
    <div className="flex items-center justify-between">
      <div className="flex flex-1 items-center space-x-2 flex-wrap">
        <div className="mb-2">
          <Input
            placeholder="Search cohorts..."
            value={(titleColumn?.getFilterValue() as string) ?? ""}
            onChange={(event) =>
              titleColumn?.setFilterValue(event.target.value)
            }
            className="h-8 w-[150px] lg:w-[250px]"
          />
        </div>

        <div className="flex items-center space-x-2 flex-wrap mb-2">
          {/* Profile Filter */}
          {profileColumn && profileOptions.length > 0 && (
            <DataTableFacetedFilter
              column={profileColumn}
              title="Profile"
              options={profileOptions}
            />
          )}

          {/* Simulation Filter */}
          {simulationColumn && simulationOptions.length > 0 && (
            <DataTableFacetedFilter
              column={simulationColumn}
              title="Simulation"
              options={simulationOptions}
            />
          )}

          {/* Class Filter */}
          {classColumn && classOptions.length > 0 && (
            <DataTableFacetedFilter
              column={classColumn}
              title="Class"
              options={classOptions}
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
      </div>
    </div>
  );
}
