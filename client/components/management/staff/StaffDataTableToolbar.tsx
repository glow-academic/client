"use client";

import { Table } from "@tanstack/react-table";
import { RefreshCw, X } from "lucide-react";

import { DataTableFacetedFilter } from "@/components/common/history/DataTableFacetedFilter";
import { DataTableViewOptions } from "@/components/common/history/DataTableViewOptions";
import CreateStaffButton from "@/components/common/staff/CreateStaffButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ProfileListItem } from "@/lib/api/v2/schemas/profile";

export interface StaffDataTableToolbarProps {
  table: Table<ProfileListItem>;
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
  deletableCount?: number;
  editableCount?: number;
  // Scope props - when provided, delete becomes "remove from relationship"
  cohortId: string | undefined; // When provided, bulk delete removes from cohort (does NOT delete profile)
  departmentId: string | undefined; // When provided, bulk delete removes from department (does NOT delete profile)
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
  deletableCount = 0,
  editableCount = 0,
  cohortId,
  departmentId,
}: StaffDataTableToolbarProps) {
  // Check if any filters are active
  const isFiltered = table.getState().columnFilters.length > 0;

  const nameColumn = table.getColumn("name");
  const roleColumn = table.getColumn("role");
  const activeColumn = table.getColumn("active");
  const lastActiveColumn = table.getColumn("lastActive");
  const cohortIdsColumn = table.getColumn("cohort_ids");

  return (
    <div className="flex items-center justify-between">
      <div className="flex flex-1 items-center space-x-2 flex-wrap">
        <div className="mb-2">
          <Input
            placeholder="Search staff by name or alias..."
            value={(nameColumn?.getFilterValue() as string) ?? ""}
            onChange={(event) => nameColumn?.setFilterValue(event.target.value)}
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
          {cohortIdsColumn && cohortOptions.length > 0 && (
            <DataTableFacetedFilter
              column={cohortIdsColumn}
              title="Cohort"
              options={cohortOptions}
            />
          )}

          {isFiltered && (
            <Button
              type="button"
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
        {/* Create Staff Button - only show when no rows are selected */}
        {onCreate && selectedCount === 0 && (
          <CreateStaffButton onDone={onCreate} />
        )}

        {/* Bulk edit/delete if any selected */}
        {selectedCount > 0 && (
          <div className="flex items-center space-x-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onBulkEdit}
              className="h-8"
            >
              Bulk Edit {editableCount} of {selectedCount}
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={onBulkDelete}
              className="h-8"
            >
              {cohortId
                ? `Remove ${deletableCount} of ${selectedCount}`
                : departmentId
                  ? `Remove ${deletableCount} of ${selectedCount}`
                  : `Delete ${deletableCount} of ${selectedCount}`}
            </Button>
          </div>
        )}

        <Button
          type="button"
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
