"use client";

import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import * as React from "react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { StaffData } from "@/hooks/use-staff-columns";
import { Edit, FileText, Trash2 } from "lucide-react";
import { StaffDataTableToolbar } from "./StaffDataTableToolbar";

export interface StaffDataTableProps {
  columns: ColumnDef<StaffData>[];
  data: StaffData[];
  roleOptions: { value: string; label: string }[];
  cohortOptions: { value: string; label: string }[];
  activityOptions: { value: string; label: string }[];
  lastActiveOptions: { value: string; label: string }[];
  isRefreshing: boolean;
  onRefresh: () => void;
  // New props for actions & selection
  selectedStaffIds: string[];
  onStaffSelect: (profileId: string, checked: boolean) => void;
  onSelectAll: (checked: boolean) => void;
  onCreate: () => void;
  onPreview: (staff: StaffData) => void;
  onEdit: (staff: StaffData) => void;
  onDelete: (staff: StaffData) => void;
  onBulkEdit: () => void;
  onBulkDelete: () => void;
  canDelete: (profileId: string) => boolean;
  deletableCount: number;
  canEdit: (profileId: string) => boolean;
  editableCount: number;
}

export function StaffDataTable({
  columns,
  data,
  roleOptions,
  cohortOptions,
  activityOptions,
  lastActiveOptions,
  isRefreshing,
  onRefresh,
  selectedStaffIds,
  onStaffSelect,
  onSelectAll,
  onCreate,
  onPreview,
  onEdit,
  onDelete,
  onBulkEdit,
  onBulkDelete,
  canDelete,
  deletableCount,
  canEdit,
  editableCount,
}: StaffDataTableProps) {
  const [rowSelection, setRowSelection] = React.useState({});
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({});
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    []
  );
  const [sorting, setSorting] = React.useState<SortingState>([
    { id: "lastActive", desc: true }, // Default sort by last active descending
  ]);

  // Build columns with checkbox + actions, filtering out any pre-supplied actions/select
  const columnsWithActions = React.useMemo(() => {
    const checkboxColumn: ColumnDef<StaffData> = {
      id: "select",
      header: ({ table }) => (
        <div className="pr-2">
          <Checkbox
            checked={
              table.getIsAllPageRowsSelected() ||
              (table.getIsSomePageRowsSelected() && "indeterminate")
            }
            onCheckedChange={(value) => {
              table.toggleAllPageRowsSelected(!!value);
              onSelectAll(!!value);
            }}
            aria-label="Select all"
            className="translate-y-[2px]"
          />
        </div>
      ),
      cell: ({ row }) => (
        <div className="pr-2">
          <Checkbox
            checked={selectedStaffIds.includes(row.original.id)}
            onCheckedChange={(value) => onStaffSelect(row.original.id, !!value)}
            aria-label="Select row"
            className="translate-y-[2px]"
          />
        </div>
      ),
      enableSorting: false,
      enableHiding: false,
    };

    const actionsColumn: ColumnDef<StaffData> = {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        const staff = row.original;
        return (
          <div className="flex items-center justify-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => onPreview(staff)}
              title="View Reports"
            >
              <FileText className="h-3 w-3" />
            </Button>
            {canEdit(staff.id) && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => onEdit(staff)}
                title="Edit Staff"
              >
                <Edit className="h-3 w-3" />
              </Button>
            )}
            {canDelete(staff.id) && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                onClick={() => onDelete(staff)}
                title="Delete Staff"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
          </div>
        );
      },
      enableSorting: false,
      enableHiding: false,
    };

    const filtered = columns.filter(
      (c) => c.id !== "select" && c.id !== "actions"
    );
    return [checkboxColumn, ...filtered, actionsColumn];
  }, [
    columns,
    onSelectAll,
    selectedStaffIds,
    onStaffSelect,
    onPreview,
    onEdit,
    onDelete,
    canDelete,
    canEdit,
  ]);

  const table = useReactTable({
    data,
    columns: columnsWithActions,
    state: {
      sorting,
      columnVisibility,
      rowSelection,
      columnFilters,
    },
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  });

  return (
    <div className="space-y-2">
      <StaffDataTableToolbar
        table={table}
        roleOptions={roleOptions}
        cohortOptions={cohortOptions}
        activityOptions={activityOptions}
        lastActiveOptions={lastActiveOptions}
        isRefreshing={isRefreshing}
        onRefresh={onRefresh}
        selectedCount={selectedStaffIds.length}
        onBulkDelete={onBulkDelete}
        onBulkEdit={onBulkEdit}
        onCreate={onCreate}
        deletableCount={deletableCount}
        editableCount={editableCount}
      />
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead
                      key={header.id}
                      colSpan={header.colSpan}
                      className={`border-r py-2 text-xs text-center ${
                        header.id === "select" ? "w-12" : ""
                      } ${
                        header.column.getCanSort()
                          ? "cursor-pointer select-none pl-4"
                          : ""
                      }`}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className="hover:bg-muted/30 transition-colors"
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className="border-r px-3 py-2 text-center"
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columnsWithActions.length}
                  className="h-24 text-center px-6"
                >
                  No staff members found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
