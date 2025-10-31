"use client";

import { Table } from "@tanstack/react-table";
import { X } from "lucide-react";

import { DataTableFacetedFilter } from "@/components/common/history/DataTableFacetedFilter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ProviderModelRow } from "./ProvidersDataTable";

export interface ProvidersDataTableToolbarProps {
  table: Table<ProviderModelRow>;
  providerOptions: { value: string; label: string }[];
  customModelOptions: { value: string; label: string }[];
  statusOptions: { value: string; label: string }[];
}

export function ProvidersDataTableToolbar({
  table,
  providerOptions,
  customModelOptions,
  statusOptions,
}: ProvidersDataTableToolbarProps) {
  const isFiltered = table.getState().columnFilters.length > 0;

  const nameColumn = table.getColumn("name");
  const providerColumn = table.getColumn("provider_id");
  const customModelColumn = table.getColumn("custom_model");
  const activeColumn = table.getColumn("active");

  return (
    <div className="flex items-center justify-between">
      <div className="flex flex-1 items-center space-x-2 flex-wrap">
        <div className="mb-2">
          <Input
            placeholder="Search models..."
            value={(nameColumn?.getFilterValue() as string) ?? ""}
            onChange={(event) => nameColumn?.setFilterValue(event.target.value)}
            className="h-8 w-[150px] lg:w-[250px]"
          />
        </div>

        <div className="flex items-center space-x-2 flex-wrap mb-2">
          {providerColumn && providerOptions.length > 0 && (
            <DataTableFacetedFilter
              column={providerColumn}
              title="Provider"
              options={providerOptions}
            />
          )}

          {customModelColumn && customModelOptions.length > 0 && (
            <DataTableFacetedFilter
              column={customModelColumn}
              title="Type"
              options={customModelOptions}
            />
          )}

          {activeColumn && statusOptions.length > 0 && (
            <DataTableFacetedFilter
              column={activeColumn}
              title="Status"
              options={statusOptions}
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
