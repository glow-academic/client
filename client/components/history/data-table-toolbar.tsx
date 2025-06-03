"use client";

import { Table } from "@tanstack/react-table";
import { X } from "lucide-react";
import { DateRange } from "react-day-picker";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTableViewOptions } from "@/components/history/data-table-view-options";
import { ExportButton } from "@/components/history/export-button";
import { DatePickerWithRange } from "@/components/ui/date-picker-range";

import { DataTableFacetedFilter } from "@/components/history/data-table-faceted-filter";
import { statuses } from "./columns"; // Import statuses from columns.tsx

// Define score options
const scoreOptions = [
  { value: "adaptability", label: "Adaptability" },
  { value: "listening", label: "Listening" },
  { value: "objectives", label: "Objectives" },
  { value: "timeManagement", label: "Time Management" },
];

interface DataTableToolbarProps<TData> {
  table: Table<TData>;
  userOptions: { value: string; label: string }[];
  classOptions: { value: string; label: string }[];
  isAdmin?: boolean;
  dateRange?: DateRange | undefined;
  setDateRange?: (range: DateRange | undefined) => void;
  viewMode?: 'chats' | 'attempts';
}

export function DataTableToolbar<TData>({
  table,
  userOptions,
  classOptions,
  isAdmin = false,
  dateRange,
  setDateRange,
  viewMode = 'chats',
}: DataTableToolbarProps<TData>) {
  // Check if any filters other than the date range are active
  const isFiltered =
    table.getState().columnFilters.filter((filter) => filter.id !== "createdAt")
      .length > 0;

  return (
    <>
      <div className="flex items-center justify-between">
        <div className="flex flex-1 items-center space-x-2">
          <Input
            placeholder={viewMode === 'chats' ? "Filter chats..." : "Filter templates..."}
            value={(table.getColumn(viewMode === 'chats' ? "title" : "templateTitle")?.getFilterValue() as string) ?? ""}
            onChange={(event) =>
              table.getColumn(viewMode === 'chats' ? "title" : "templateTitle")?.setFilterValue(event.target.value)
            }
            className="h-8 w-[150px] lg:w-[250px]"
          />
          {/* {viewMode === 'chats' && table.getColumn("status") && (
            <DataTableFacetedFilter
              column={table.getColumn("status")}
              title="Status"
              options={statuses}
            />
          )} */}
          {isAdmin && viewMode === 'chats' && table.getColumn("userId") && (
            <DataTableFacetedFilter
              column={table.getColumn("userId")}
              title="Name"
              options={userOptions}
            />
          )}
          {table.getColumn(viewMode === 'chats' ? "classId" : "classCode") && (
            <DataTableFacetedFilter
              column={table.getColumn(viewMode === 'chats' ? "classId" : "classCode")}
              title="Class"
              options={classOptions}
            />
          )}
          {viewMode === 'chats' && table.getColumn("score") && ( // This is for the score column which uses id as accessor
            <DataTableFacetedFilter
              column={table.getColumn("score")}
              title="Score"
              options={scoreOptions}
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

          <ExportButton
            table={table}
            userOptions={userOptions}
            classOptions={classOptions}
            viewMode={viewMode}
          />
          
          <DataTableViewOptions table={table} isAdmin={isAdmin} />
        </div>
      </div>

    </>
  );
}
