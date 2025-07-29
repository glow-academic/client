"use client";

import { Table } from "@tanstack/react-table";
import { RefreshCw } from "lucide-react";

import { DataTableFacetedFilter } from "@/components/common/history/DataTableFacetedFilter";
import { DataTableViewOptions } from "@/components/common/history/DataTableViewOptions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AppLog } from "@/hooks/use-log-columns";

export interface LogsDataTableToolbarProps {
  table: Table<AppLog>;
  levelOptions: { value: string; label: string }[];
  onRefresh: () => void;
  isRefreshing: boolean;
}

export function LogsDataTableToolbar({
  table,
  levelOptions,
  onRefresh,
  isRefreshing,
}: LogsDataTableToolbarProps) {
  // Check if any filters are active
  const isFiltered = table.getState().columnFilters.length > 0;

  const messageColumn = table.getColumn("message");
  const levelColumn = table.getColumn("level");

  return (
    <div className="flex items-center justify-between">
      <div className="flex flex-1 items-center space-x-2 flex-wrap">
        <div className="mb-2">
          <Input
            placeholder="Search messages..."
            value={(messageColumn?.getFilterValue() as string) ?? ""}
            onChange={(event) =>
              messageColumn?.setFilterValue(event.target.value)
            }
            className="h-8 w-[150px] lg:w-[250px]"
          />
        </div>

        <div className="flex items-center space-x-2 flex-wrap mb-2">
          {/* Level Filter */}
          {levelColumn && levelOptions.length > 0 && (
            <DataTableFacetedFilter
              column={levelColumn}
              title="Level"
              options={levelOptions}
            />
          )}

          {isFiltered && (
            <Button
              variant="ghost"
              onClick={() => table.resetColumnFilters()}
              className="h-8 px-2 lg:px-3"
            >
              Reset
            </Button>
          )}
        </div>
      </div>

      <div className="flex items-center space-x-2">
        {/* Refresh Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={isRefreshing}
          className="h-8 px-2"
        >
          <RefreshCw
            className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
          />
        </Button>

        {/* Column Visibility */}
        <DataTableViewOptions table={table} />
      </div>
    </div>
  );
}
