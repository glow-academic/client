"use client";

import { Table } from "@tanstack/react-table";
import { Plus, RefreshCw, X } from "lucide-react";

import { DataTableFacetedFilter } from "@/components/common/history/DataTableFacetedFilter";
import { DataTableViewOptions } from "@/components/common/history/DataTableViewOptions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StaffData } from "@/hooks/use-staff-columns";

export interface StaffDataTableToolbarProps {
  table: Table<StaffData>;
  roleOptions: { value: string; label: string }[];
  cohortOptions: { value: string; label: string }[];
  activityOptions: { value: string; label: string }[];
  lastActiveOptions: { value: string; label: string }[];
  isRefreshing: boolean;
  onRefresh: () => void;
  selectedCount: number;
  onBulkEdit: () => void;
  onBulkDelete: () => void;
  onCreate: () => void;
}

export function StaffDataTableToolbar({
  table,
  roleOptions,
  cohortOptions,
  activityOptions,
  lastActiveOptions,
  isRefreshing,
  onRefresh,
  selectedCount,
  onBulkEdit,
  onBulkDelete,
  onCreate,
}: StaffDataTableToolbarProps) {
  // Check if any filters are active
  const isFiltered = table.getState().columnFilters.length > 0;

  const firstNameColumn = table.getColumn("firstName");
  const roleColumn = table.getColumn("role");
  const activeColumn = table.getColumn("active");
  const lastActiveColumn = table.getColumn("lastActive");
  const cohortNamesColumn = table.getColumn("cohortNames");

  return (
    <div className="flex items-center justify-between">
      <div className="flex flex-1 items-center space-x-2 flex-wrap">
        <div className="mb-2">
          <Input
            placeholder="Search staff by name or alias..."
            value={(firstNameColumn?.getFilterValue() as string) ?? ""}
            onChange={(event) =>
              firstNameColumn?.setFilterValue(event.target.value)
            }
            className="h-8 w-[150px] lg:w-[250px]"
          />
        </div>

        <div className="flex items-center space-x-2 flex-wrap mb-2">
          {/* Role Filter */}
          {roleColumn && roleOptions.length > 0 && (
            <DataTableFacetedFilter
              column={roleColumn}
              title="Role"
              options={roleOptions}
            />
          )}

          {/* Activity Filter */}
          {activeColumn && activityOptions.length > 0 && (
            <DataTableFacetedFilter
              column={activeColumn}
              title="Status"
              options={activityOptions}
            />
          )}

          {/* Last Active Filter */}
          {lastActiveColumn && lastActiveOptions.length > 0 && (
            <DataTableFacetedFilter
              column={lastActiveColumn}
              title="Last Active"
              options={lastActiveOptions}
            />
          )}

          {/* Cohort Filter */}
          {cohortNamesColumn && cohortOptions.length > 0 && (
            <DataTableFacetedFilter
              column={cohortNamesColumn}
              title="Cohort"
              options={cohortOptions}
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
        {/* Create Staff */}
        <Button size="sm" onClick={onCreate} className="h-8">
          <Plus className="h-4 w-4 mr-2" /> Create Staff
        </Button>

        {/* Bulk edit/delete if any selected */}
        {selectedCount > 0 && (
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onBulkEdit}
              className="h-8"
            >
              Bulk Edit ({selectedCount})
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={onBulkDelete}
              className="h-8"
            >
              Delete ({selectedCount})
            </Button>
          </div>
        )}

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
