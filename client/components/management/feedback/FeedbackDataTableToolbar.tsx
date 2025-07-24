"use client";

import { Table } from "@tanstack/react-table";
import { RefreshCw, X } from "lucide-react";
import { useMemo } from "react";

import { DataTableFacetedFilter } from "@/components/common/history/DataTableFacetedFilter";
import { DataTableViewOptions } from "@/components/common/history/DataTableViewOptions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FeedbackData } from "@/hooks/use-feedback-columns";

export interface FeedbackDataTableToolbarProps {
  table: Table<FeedbackData>;
  typeOptions: { value: string; label: string }[];
  profileOptions: { value: string; label: string }[];
  isRefreshing: boolean;
  onRefresh: () => void;
}

export function FeedbackDataTableToolbar({
  table,
  typeOptions,
  profileOptions,
  isRefreshing,
  onRefresh,
}: FeedbackDataTableToolbarProps) {
  // Check if any filters are active
  const isFiltered = table.getState().columnFilters.length > 0;

  const messageColumn = table.getColumn("message");
  const typeColumn = table.getColumn("type");
  const authorColumn = table.getColumn("authorName");
  const idColumn = table.getColumn("id");

  // Generate ID options for filtering
  const idOptions = useMemo(() => {
    const uniqueIds = new Set<number>();
    table.getFilteredRowModel().rows.forEach((row) => {
      uniqueIds.add(row.original.id);
    });
    return Array.from(uniqueIds)
      .sort((a, b) => a - b)
      .map((id) => ({
        value: id.toString(),
        label: `ID: ${id}`,
      }));
  }, [table]);

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
          {/* ID Filter */}
          {idColumn && idOptions.length > 0 && (
            <DataTableFacetedFilter
              column={idColumn}
              title="ID"
              options={idOptions}
            />
          )}

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
        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={isRefreshing}
        >
          <RefreshCw
            className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
          />
        </Button>

        <DataTableViewOptions table={table} />
      </div>
    </div>
  );
}
