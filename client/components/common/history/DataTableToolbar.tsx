"use client";

import { Table } from "@tanstack/react-table";
import { Archive, Unlock, X } from "lucide-react";

import { DataTableViewOptions } from "@/components/common/table/DataTableViewOptions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { DataTableFacetedFilter } from "@/components/common/table/DataTableFacetedFilter";
import { SingleProfileCertificateButton } from "./SingleProfileCertificateButton";

export interface DataTableToolbarProps<TData> {
  table: Table<TData>;
  profileOptions?: { value: string; label: string }[];
  simulationOptions?: { value: string; label: string }[];
  scenarioOptions?: { value: string; label: string }[];
  infiniteModeOptions?: { value: string; label: string }[];
  isAdmin?: boolean;
  showExport?: boolean;
  showAll?: boolean;
  showArchive?: boolean;
  selectedAttempts?: string[];
  onBulkArchive?: (archive: boolean) => Promise<void>;
  onSelectAllVisibleRows?: () => void;
}

export function DataTableToolbar<TData>({
  table,
  profileOptions = [],
  simulationOptions = [],
  scenarioOptions = [],
  infiniteModeOptions = [],
  isAdmin = false,
  showExport = true,
  showAll = false,
  showArchive = false,
  selectedAttempts: _selectedAttempts = [],
  onBulkArchive,
  onSelectAllVisibleRows,
}: DataTableToolbarProps<TData>) {
  // Check if any filters are active
  const isFiltered = table.getState().columnFilters.length > 0;

  const profileIdColumn = showAll ? table.getColumn("profileId") : null;
  const simulationIdColumn = table.getColumn("simulationId");
  const scenariosColumn = table.getColumn("scenarios");
  const infiniteModeColumn = table.getColumn("infiniteMode");

  // Determine visibility of each filter
  const nameFilterVisible =
    profileIdColumn !== null && profileOptions.length > 0;
  const simulationFilterVisible = simulationOptions.length > 0;
  const scenariosFilterVisible = scenarioOptions.length > 0;

  // Show mode filter only when NOT all 3 other filters are visible
  const shouldShowModeFilter =
    infiniteModeColumn &&
    infiniteModeOptions.length > 0 &&
    !(nameFilterVisible && simulationFilterVisible && scenariosFilterVisible);

  // Helper functions to normalize id and archived fields
  const getArchived = (o: unknown) => {
    const obj = o as Record<string, unknown>;
    return Boolean(obj["archived"] ?? obj["isArchived"] ?? false);
  };

  // Calculate archive/unarchive counts from selected rows
  const selectedRows = table.getSelectedRowModel().flatRows;
  let archiveCount = 0,
    unarchiveCount = 0;
  for (const r of selectedRows) {
    if (getArchived(r.original)) unarchiveCount++;
    else archiveCount++;
  }

  // Detect if this is page selection vs filtered selection
  const pageCount = table.getRowModel().rows.length;
  const filteredCount = table.getFilteredRowModel().rows.length;
  const selectedCount = selectedRows.length;

  const isPageSelection =
    selectedCount > 0 &&
    selectedCount ===
      table.getRowModel().rows.filter((r) => r.getIsSelected()).length;

  const ofLabel = isPageSelection ? pageCount : filteredCount;

  return (
    <>
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
        <div className="flex flex-col md:flex-row md:flex-1 md:items-center md:space-x-2 gap-2 md:gap-0">
          {/* Mobile: If showExport, wrap search and certificate button in 50/50 flex */}
          {showExport ? (
            <div className="flex gap-2 w-full md:w-auto md:flex-initial">
              <Input
                placeholder="Search by name, simulation, or scenarios..."
                value={
                  (table.getColumn("search")?.getFilterValue() as string) ?? ""
                }
                onChange={(event) =>
                  table.getColumn("search")?.setFilterValue(event.target.value)
                }
                className="h-8 flex-1 md:w-[150px] lg:w-[250px]"
              />
              <div className="flex-1 md:hidden">
                <SingleProfileCertificateButton
                  table={table}
                  profileOptions={profileOptions}
                />
              </div>
            </div>
          ) : (
            <Input
              placeholder="Search by name, simulation, or scenarios..."
              value={
                (table.getColumn("search")?.getFilterValue() as string) ?? ""
              }
              onChange={(event) =>
                table.getColumn("search")?.setFilterValue(event.target.value)
              }
              className="h-8 w-full md:w-[150px] lg:w-[250px]"
            />
          )}
          {/* Filters - separate row on mobile to prevent flicker */}
          <div className="flex items-center space-x-2 flex-wrap">
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

            {/* Mode filter - only show when not all 3 other filters are visible */}
            {shouldShowModeFilter && (
              <DataTableFacetedFilter
                column={infiniteModeColumn}
                title="Mode"
                options={infiniteModeOptions}
              />
            )}

            {isFiltered && (
              <Button
                variant="ghost"
                onClick={() => table.resetColumnFilters()}
                className="h-8 px-2 lg:px-3 hidden md:flex"
              >
                Reset
                <X className="ml-2 h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {/* Select All Rows button - only show when showArchive is true, some rows are selected, but not all filtered */}
          {showArchive &&
            selectedRows.length > 0 &&
            selectedRows.length < table.getFilteredRowModel().rows.length &&
            onSelectAllVisibleRows && (
              <Button
                variant="outline"
                size="sm"
                onClick={onSelectAllVisibleRows}
                className="h-8"
              >
                Select All Rows
              </Button>
            )}

          {/* Bulk archive buttons - only show when showArchive is true and items are selected */}
          {showArchive && selectedRows.length > 0 && (
            <>
              {archiveCount > 0 && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => onBulkArchive?.(true)}
                  className="h-8"
                >
                  <Archive className="mr-2 h-4 w-4" />
                  Archive {archiveCount} of {ofLabel}
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
                  Unarchive {unarchiveCount} of {ofLabel}
                </Button>
              )}
            </>
          )}

          {/* Certificate button - only show on desktop when showExport is true (mobile is handled above in search area) */}
          {showExport && (
            <div className="hidden md:flex">
              <SingleProfileCertificateButton
                table={table}
                profileOptions={profileOptions}
              />
            </div>
          )}

          <DataTableViewOptions table={table} isAdmin={isAdmin} />
        </div>
      </div>
    </>
  );
}
