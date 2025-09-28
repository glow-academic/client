"use client";

import { Table } from "@tanstack/react-table";
import { Archive, Unlock, X } from "lucide-react";

import { DataTableViewOptions } from "@/components/common/history/DataTableViewOptions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { DataTableFacetedFilter } from "@/components/common/history/DataTableFacetedFilter";
import { SingleProfileCertificateButton } from "./SingleProfileCertificateButton";

export interface DataTableToolbarProps<TData> {
  table: Table<TData>;
  profileOptions?: { value: string; label: string }[];
  simulationOptions?: { value: string; label: string }[];
  scenarioOptions?: { value: string; label: string }[];
  isAdmin?: boolean;
  showExport?: boolean;
  showAll?: boolean;
  showArchive?: boolean;
  selectedAttempts?: string[];
  onBulkArchive?: (archive: boolean) => Promise<void>;
  cohortData?: Array<{
    name: string;
    passed: boolean;
    simulations: Array<{
      name: string;
      score: number;
      passed: boolean;
    }>;
  }>;
}

export function DataTableToolbar<TData>({
  table,
  profileOptions = [],
  simulationOptions = [],
  scenarioOptions = [],
  isAdmin = false,
  showExport = true,
  showAll = false,
  showArchive = false,
  selectedAttempts = [],
  onBulkArchive,
  cohortData = [],
}: DataTableToolbarProps<TData>) {
  // Check if any filters are active
  const isFiltered = table.getState().columnFilters.length > 0;

  const profileIdColumn = showAll ? table.getColumn("profileId") : null;
  const simulationIdColumn = table.getColumn("simulationId");
  const scenariosColumn = table.getColumn("scenarios");

  // Calculate archive/unarchive counts
  const archiveCount = selectedAttempts.filter((attemptId) => {
    const row = table
      .getRowModel()
      .rows.find(
        (r) => (r.original as unknown as { id: string }).id === attemptId
      );
    return row && !(row.original as unknown as { archived: boolean }).archived;
  }).length;

  const unarchiveCount = selectedAttempts.filter((attemptId) => {
    const row = table
      .getRowModel()
      .rows.find(
        (r) => (r.original as unknown as { id: string }).id === attemptId
      );
    return row && (row.original as unknown as { archived: boolean }).archived;
  }).length;

  return (
    <>
      <div className="flex items-center justify-between">
        <div className="flex flex-1 items-center space-x-2">
          <Input
            placeholder="Search by name, simulation, or scenarios..."
            value={
              (table.getColumn("search")?.getFilterValue() as string) ?? ""
            }
            onChange={(event) =>
              table.getColumn("search")?.setFilterValue(event.target.value)
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

          {/* Simulation filter */}
          {simulationIdColumn && simulationOptions.length > 0 && (
            <DataTableFacetedFilter
              column={simulationIdColumn}
              title="Simulation"
              options={simulationOptions}
            />
          )}

          {/* Scenarios filter */}
          {scenariosColumn && scenarioOptions.length > 0 && (
            <DataTableFacetedFilter
              column={scenariosColumn}
              title="Scenarios"
              options={scenarioOptions}
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
          {/* Bulk archive buttons - only show when showArchive is true and items are selected */}
          {showArchive && selectedAttempts.length > 0 && (
            <>
              {archiveCount > 0 && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => onBulkArchive?.(true)}
                  className="h-8"
                >
                  <Archive className="mr-2 h-4 w-4" />
                  Archive {archiveCount} of {selectedAttempts.length}
                </Button>
              )}
              {unarchiveCount > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onBulkArchive?.(false)}
                  className="h-8"
                >
                  <Unlock className="mr-2 h-4 w-4" />
                  Unarchive {unarchiveCount} of {selectedAttempts.length}
                </Button>
              )}
            </>
          )}

          {showExport && (
            <>
              <SingleProfileCertificateButton
                table={table}
                profileOptions={profileOptions}
                cohortData={cohortData}
              />
            </>
          )}

          <DataTableViewOptions table={table} isAdmin={isAdmin} />
        </div>
      </div>
    </>
  );
}
