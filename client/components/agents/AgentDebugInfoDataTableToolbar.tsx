"use client";

import { Table } from "@tanstack/react-table";
import { X } from "lucide-react";

import { DataTableFacetedFilter } from "@/components/common/table/DataTableFacetedFilter";
import { DataTableViewOptions } from "@/components/common/table/DataTableViewOptions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AgentDebugInfoRow } from "./AgentDebugInfo";

export interface AgentDebugInfoDataTableToolbarProps {
  table: Table<AgentDebugInfoRow>;
  modelOptions: { value: string; label: string }[];
}

export function AgentDebugInfoDataTableToolbar({
  table,
  modelOptions,
}: AgentDebugInfoDataTableToolbarProps) {
  const isFiltered = table.getState().columnFilters.length > 0;

  const contentColumn = table.getColumn("content");
  const modelColumn = table.getColumn("modelId");

  return (
    <div className="flex items-center justify-between">
      <div className="flex flex-1 items-center space-x-2 flex-wrap">
        <div className="mb-2">
          <Input
            placeholder="Search content..."
            value={(contentColumn?.getFilterValue() as string) ?? ""}
            onChange={(event) =>
              contentColumn?.setFilterValue(event.target.value)
            }
            className="h-8 w-[150px] lg:w-[300px]"
          />
        </div>

        <div className="flex items-center space-x-2 flex-wrap mb-2">
          {modelColumn && modelOptions.length > 0 && (
            <DataTableFacetedFilter
              column={modelColumn}
              title="Model"
              options={modelOptions}
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

export default AgentDebugInfoDataTableToolbar;
