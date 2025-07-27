"use client";

import { Table } from "@tanstack/react-table";
import { Grid3X3, List, Trash2, X } from "lucide-react";

import { DataTableFacetedFilter } from "@/components/common/history/DataTableFacetedFilter";
import { DataTableViewOptions } from "@/components/common/history/DataTableViewOptions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Document } from "@/types";
import { TooltipProvider } from "@radix-ui/react-tooltip";

export interface DocumentsDataTableToolbarProps {
  table: Table<Document>;
  typeOptions: { value: string; label: string }[];
  scenarioOptions: { value: string; label: string }[];
  extensionOptions: { value: string; label: string }[];
  viewMode: "grid" | "list";
  onViewModeChange: (mode: "grid" | "list") => void;
  selectedCount: number;
  onBulkDelete: () => void;
  canDeleteDocument: (documentId: string) => boolean;
  selectedDocuments: string[];
}

export function DocumentsDataTableToolbar({
  table,
  typeOptions,
  scenarioOptions,
  extensionOptions,
  viewMode,
  onViewModeChange,
  selectedCount,
  onBulkDelete,
  canDeleteDocument,
  selectedDocuments,
}: DocumentsDataTableToolbarProps) {
  const isFiltered = table.getState().columnFilters.length > 0;

  // Get columns for filters
  const nameColumn = table.getColumn("name");
  const typeColumn = table.getColumn("type");
  const scenariosColumn = table.getColumn("scenarios");
  const extensionColumn = table.getColumn("extension");

  // Calculate deletable documents count
  const deletableCount = selectedDocuments.filter((documentId) =>
    canDeleteDocument(documentId),
  ).length;

  return (
    <div className="flex items-center justify-between">
      <div className="flex flex-1 items-center space-x-2">
        <Input
          placeholder="Filter documents..."
          value={(nameColumn?.getFilterValue() as string) ?? ""}
          onChange={(event) => nameColumn?.setFilterValue(event.target.value)}
          className="h-8 w-[150px] lg:w-[250px]"
        />
        {typeColumn && (
          <DataTableFacetedFilter
            column={typeColumn}
            title="Type"
            options={typeOptions}
          />
        )}
        {scenariosColumn && (
          <DataTableFacetedFilter
            column={scenariosColumn}
            title="Scenarios"
            options={scenarioOptions}
          />
        )}
        {extensionColumn && (
          <DataTableFacetedFilter
            column={extensionColumn}
            title="Extension"
            options={extensionOptions}
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
        {/* Bulk delete button - only show in list view where selection is available */}
        {viewMode === "list" &&
          selectedCount > 0 &&
          (deletableCount === 0 ? (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild={deletableCount !== 0}>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="h-8"
                    disabled={true}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete {deletableCount} of {selectedCount}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>All documents are currently in use</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : (
            <Button
              variant="destructive"
              size="sm"
              onClick={onBulkDelete}
              className="h-8"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete {deletableCount} of {selectedCount}
            </Button>
          ))}

        {/* View mode toggle */}
        <div className="flex items-center space-x-1 border rounded-md">
          <Button
            variant={viewMode === "list" ? "default" : "ghost"}
            size="sm"
            onClick={() => onViewModeChange("list")}
            className="h-8 px-3"
          >
            <List className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === "grid" ? "default" : "ghost"}
            size="sm"
            onClick={() => onViewModeChange("grid")}
            className="h-8 px-3"
          >
            <Grid3X3 className="h-4 w-4" />
          </Button>
        </div>

        <DataTableViewOptions table={table} />
      </div>
    </div>
  );
}
