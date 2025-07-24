"use client";

import { Table } from "@tanstack/react-table";
import { X } from "lucide-react";

import { DataTableFacetedFilter } from "@/components/common/history/DataTableFacetedFilter";
import { DataTableViewOptions } from "@/components/common/history/DataTableViewOptions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FeedbackData } from "@/hooks/use-feedback-columns";

export interface FeedbackDataTableToolbarProps {
  table: Table<FeedbackData>;
  typeOptions: { value: string; label: string }[];
  profileOptions: { value: string; label: string }[];
}

export function FeedbackDataTableToolbar({
  table,
  typeOptions,
  profileOptions,
}: FeedbackDataTableToolbarProps) {
  // Check if any filters are active
  const isFiltered = table.getState().columnFilters.length > 0;

  const messageColumn = table.getColumn("message");
  const typeColumn = table.getColumn("type");
  const authorColumn = table.getColumn("authorName");

  return (
    <div className="flex items-center justify-between">
      <div className="flex flex-1 items-center space-x-2 flex-wrap">
        <div className="mb-2">
          <Input
            placeholder="Search feedback or author..."
            value={(messageColumn?.getFilterValue() as string) ?? ""}
            onChange={(event) =>
              messageColumn?.setFilterValue(event.target.value)
            }
            className="h-8 w-[150px] lg:w-[250px]"
          />
        </div>

        <div className="flex items-center space-x-2 flex-wrap mb-2">
          {/* Type Filter */}
          {typeColumn && typeOptions.length > 0 && (
            <DataTableFacetedFilter
              column={typeColumn}
              title="Type"
              options={typeOptions}
            />
          )}

          {/* Author Filter */}
          {authorColumn && profileOptions.length > 0 && (
            <DataTableFacetedFilter
              column={authorColumn}
              title="Author"
              options={profileOptions}
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

      <div className="flex items-center space-x-2 mb-2">
        <DataTableViewOptions table={table} />
      </div>
    </div>
  );
}
