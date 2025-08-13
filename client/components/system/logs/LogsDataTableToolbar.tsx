"use client";

import { Table } from "@tanstack/react-table";
import { RefreshCw } from "lucide-react";

import { DataTableFacetedFilter } from "@/components/common/history/DataTableFacetedFilter";
import { DataTableViewOptions } from "@/components/common/history/DataTableViewOptions";
import { Button } from "@/components/ui/button";
import { DatePickerWithRange } from "@/components/ui/date-picker-range";
import { Input } from "@/components/ui/input";
import { AppLog } from "@/hooks/use-log-columns";
import type { DateRange } from "react-day-picker";

export interface LogsDataTableToolbarProps {
  table: Table<AppLog>;
  levelOptions: { value: string; label: string }[];
  eventOptions: { value: string; label: string }[];
  providerOptions: { value: string; label: string }[];
  modelOptions: { value: string; label: string }[];
  errorOptions: { value: string; label: string }[];
  actorOptions: { value: string; label: string }[];
  componentOptions: { value: string; label: string }[];
  functionOptions: { value: string; label: string }[];
  dateRange: DateRange | undefined;
  setDateRange: (range: DateRange | undefined) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
}

export function LogsDataTableToolbar({
  table,
  levelOptions,
  eventOptions,
  providerOptions,
  modelOptions,
  errorOptions,
  actorOptions,
  componentOptions,
  functionOptions,
  dateRange,
  setDateRange,
  onRefresh,
  isRefreshing,
}: LogsDataTableToolbarProps) {
  // Check if any filters are active
  const isFiltered = table.getState().columnFilters.length > 0;

  const messageColumn = table.getColumn("message");
  const levelColumn = table.getColumn("level");
  const eventColumn = table.getColumn("event");
  const providerColumn = table.getColumn("provider");
  const modelColumn = table.getColumn("model");
  const errorColumn = table.getColumn("hasError");
  const createdAtColumn = table.getColumn("createdAt");
  const actorColumn = table.getColumn("actor");
  const componentColumn = table.getColumn("component");
  const functionColumn = table.getColumn("function");

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

          {/* Event Filter */}
          {eventColumn && eventOptions.length > 0 && (
            <DataTableFacetedFilter
              column={eventColumn}
              title="Event"
              options={eventOptions}
            />
          )}

          {/* Provider Filter */}
          {providerColumn && providerOptions.length > 0 && (
            <DataTableFacetedFilter
              column={providerColumn}
              title="Provider"
              options={providerOptions}
            />
          )}

          {/* Model Filter */}
          {modelColumn && modelOptions.length > 0 && (
            <DataTableFacetedFilter
              column={modelColumn}
              title="Model"
              options={modelOptions}
            />
          )}

          {/* Actor Filter */}
          {actorColumn && actorOptions.length > 0 && (
            <DataTableFacetedFilter
              column={actorColumn}
              title="Actor"
              options={actorOptions}
            />
          )}

          {/* Component Filter */}
          {componentColumn && componentOptions.length > 0 && (
            <DataTableFacetedFilter
              column={componentColumn}
              title="Component"
              options={componentOptions}
            />
          )}

          {/* Function Filter */}
          {functionColumn && functionOptions.length > 0 && (
            <DataTableFacetedFilter
              column={functionColumn}
              title="Function"
              options={functionOptions}
            />
          )}

          {/* Error presence */}
          {errorColumn && (
            <DataTableFacetedFilter
              column={errorColumn}
              title="Has Error"
              options={errorOptions}
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
        {/* Date Range */}
        <DatePickerWithRange
          dateRange={dateRange}
          setDateRange={(range) => {
            setDateRange(range);
            createdAtColumn?.setFilterValue(range);
          }}
        />
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
