"use client";

import { Table } from "@tanstack/react-table";
import { X } from "lucide-react";
import { DateRange } from "react-day-picker";

import { DataTableViewOptions } from "@/components/common/history/DataTableViewOptions";
import { Button } from "@/components/ui/button";
import { DatePickerWithRange } from "@/components/ui/date-picker-range";
import { Input } from "@/components/ui/input";

import { DataTableFacetedFilter } from "@/components/common/history/DataTableFacetedFilter";
import { SingleProfileBrightspaceExportButton } from "./SingleProfileBrightspaceExportButton";

export interface DataTableToolbarProps<TData> {
  table: Table<TData>;
  profileOptions: { value: string; label: string }[];
  scoreRangeOptions: { value: string; label: string }[];
  isAdmin?: boolean;
  dateRange?: DateRange | undefined;
  setDateRange?: (range: DateRange | undefined) => void;
  showExport?: boolean;
  showAll?: boolean;
}

export function DataTableToolbar<TData>({
  table,
  profileOptions,
  scoreRangeOptions,
  isAdmin = false,
  dateRange,
  setDateRange,
  showExport = true,
  showAll = false,
}: DataTableToolbarProps<TData>) {
  // Check if any filters other than the date range are active
  const isFiltered =
    table.getState().columnFilters.filter((filter) => filter.id !== "createdAt")
      .length > 0;

  const profileIdColumn = showAll ? table.getColumn("profileId") : null;
  const averageScoreColumn = table.getColumn("averageScore");

  return (
    <>
      <div className="flex items-center justify-between">
        <div className="flex flex-1 items-center space-x-2">
          <Input
            placeholder="Filter simulations..."
            value={
              (table
                .getColumn("simulationTitle")
                ?.getFilterValue() as string) ?? ""
            }
            onChange={(event) =>
              table
                .getColumn("simulationTitle")
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

          {/* Score filter */}
          {averageScoreColumn && scoreRangeOptions.length > 0 && (
            <DataTableFacetedFilter
              column={averageScoreColumn}
              title="Score"
              options={scoreRangeOptions}
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
          {/* Date range picker */}
          {setDateRange && (
            <DatePickerWithRange
              dateRange={dateRange}
              setDateRange={setDateRange}
              className="w-auto"
            />
          )}

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
