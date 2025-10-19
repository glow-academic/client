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

import { DataTableColumnHeader } from "@/components/common/history/DataTableColumnHeader";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { ProfileListItem } from "@/lib/api/v2/schemas/profile";
import {
  Clock,
  Edit,
  FileText,
  Shield,
  Trash2,
  User as UserIcon,
} from "lucide-react";
import { StaffDataTableToolbar } from "./StaffDataTableToolbar";

// Helper functions
const getInitials = (firstName: string, lastName: string): string => {
  if (!firstName && !lastName) return "??";
  const first = firstName?.charAt(0) || "";
  const last = lastName?.charAt(0) || "";
  return (first + last).toUpperCase() || "??";
};

const getRoleIcon = (role: string) => {
  switch (role) {
    case "superadmin":
    case "admin":
    case "instructional":
      return Shield;
    case "ta":
    case "guest":
    default:
      return UserIcon;
  }
};

const getRoleDisplayName = (role: string): string => {
  switch (role) {
    case "superadmin":
      return "Super Administrator";
    case "admin":
      return "Administrator";
    case "instructional":
      return "Instructional Staff";
    case "ta":
      return "Teaching Assistant";
    case "guest":
      return "Guest";
    default:
      return role.charAt(0).toUpperCase() + role.slice(1);
  }
};

const formatLastActive = (timestamp: string | null): string => {
  if (!timestamp) return "Never";

  const date = new Date(timestamp);
  const now = new Date();
  const diffInMinutes = Math.floor(
    (now.getTime() - date.getTime()) / (1000 * 60)
  );

  if (diffInMinutes < 1) return "Just now";
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 30) return `${diffInDays}d ago`;

  const diffInMonths = Math.floor(diffInDays / 30);
  return `${diffInMonths}mo ago`;
};

export interface StaffDataTableProps {
  data: ProfileListItem[];
  cohortMapping: Record<string, { name: string; description?: string | null }>;
  roleOptions: { value: string; label: string }[];
  cohortOptions: { value: string; label: string }[];
  activityOptions: { value: string; label: string }[];
  lastActiveOptions: { value: string; label: string }[];
  isRefreshing: boolean;
  onRefresh: () => void;
  // New props for actions & selection
  selectedStaffIds: string[];
  onStaffSelect: (profileId: string, checked: boolean) => void;
  onSelectAll: (checked: boolean, visibleRowIds?: string[]) => void;
  onCreate: () => void;
  onPreview: (staff: ProfileListItem) => void;
  onEdit: (staff: ProfileListItem) => void;
  onDelete: (staff: ProfileListItem) => void;
  onBulkEdit: () => void;
  onBulkDelete: () => void;
  canDelete: (profileId: string) => boolean;
  deletableCount: number;
  canEdit: (profileId: string) => boolean;
  editableCount: number;
}

export function StaffDataTable({
  data,
  cohortMapping,
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
    { id: "last_active", desc: true }, // Default sort by last active descending
  ]);

  // Define columns with rich visual styling
  const columns = React.useMemo<ColumnDef<ProfileListItem>[]>(
    () => [
      {
        accessorKey: "first_name",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Staff Member" />
        ),
        cell: ({ row }) => {
          const staff = row.original;
          return (
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div
                  className="h-8 w-8 rounded-full outline outline-muted-foreground flex items-center justify-center text-xs font-medium"
                  style={{ outlineWidth: "1px", outlineStyle: "solid" }}
                >
                  {getInitials(staff.first_name, staff.last_name)}
                </div>
                <div className="text-left">
                  <p className="font-medium text-sm">
                    {staff.first_name} {staff.last_name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {staff.alias}@{process.env["NEXT_PUBLIC_CAMPUS_EMAIL"]}
                  </p>
                </div>
              </div>
              <div
                className={`w-2 h-2 rounded-full ${
                  staff.active ? "bg-green-500" : "bg-gray-400"
                }`}
                title={staff.active ? "Active" : "Inactive"}
              />
            </div>
          );
        },
        enableSorting: true,
        filterFn: (row, _, value) => {
          const staff = row.original;
          if (!value) return true;
          return (
            staff.first_name.toLowerCase().includes(value.toLowerCase()) ||
            staff.last_name.toLowerCase().includes(value.toLowerCase()) ||
            staff.alias.toLowerCase().includes(value.toLowerCase())
          );
        },
      },
      {
        accessorKey: "role",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Role" />
        ),
        cell: ({ row }) => {
          const staff = row.original;
          const RoleIcon = getRoleIcon(staff.role);
          return (
            <div className="flex items-center gap-2">
              <RoleIcon className="h-4 w-4" />
              <span className="text-sm font-medium">
                {getRoleDisplayName(staff.role)}
              </span>
            </div>
          );
        },
        enableSorting: true,
        enableColumnFilter: true,
        filterFn: (row, _, value) => {
          const staff = row.original;
          if (!value || value.length === 0) return true;
          return value.includes(staff.role);
        },
      },
      {
        accessorKey: "cohort_ids",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Cohorts" />
        ),
        cell: ({ row }) => {
          const cohortIds = row.getValue("cohort_ids") as string[];
          if (!cohortIds.length) {
            return <span className="text-xs text-muted-foreground">None</span>;
          }
          return (
            <div className="text-sm">
              {cohortIds.map((id) => cohortMapping[id]?.name || id).join(", ")}
            </div>
          );
        },
      },
      {
        accessorKey: "last_active",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Last Active" />
        ),
        cell: ({ row }) => {
          const lastActive = row.getValue("last_active") as string | null;
          const formatted = formatLastActive(lastActive);
          return (
            <div className="flex items-center gap-2">
              <Clock className="h-3 w-3 text-muted-foreground" />
              <span
                className={`text-sm ${!lastActive ? "text-muted-foreground" : ""}`}
              >
                {formatted}
              </span>
            </div>
          );
        },
        enableSorting: true,
        sortingFn: "datetime",
      },
    ],
    [cohortMapping]
  );

  // Build columns with checkbox + actions, filtering out any pre-supplied actions/select
  const columnsWithActions = React.useMemo(() => {
    const checkboxColumn: ColumnDef<ProfileListItem> = {
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
              // Get the IDs of currently visible rows
              const visibleRowIds = table
                .getFilteredRowModel()
                .rows.map((row) => row.original.profile_id);
              onSelectAll(!!value, visibleRowIds);
            }}
            aria-label="Select all"
            className="translate-y-[2px]"
          />
        </div>
      ),
      cell: ({ row }) => (
        <div className="pr-2">
          <Checkbox
            checked={selectedStaffIds.includes(row.original.profile_id)}
            onCheckedChange={(value) =>
              onStaffSelect(row.original.profile_id, !!value)
            }
            aria-label="Select row"
            className="translate-y-[2px]"
          />
        </div>
      ),
      enableSorting: false,
      enableHiding: false,
    };

    const actionsColumn: ColumnDef<ProfileListItem> = {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        const staff = row.original;
        return (
          <div className="flex items-center justify-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => onPreview(staff)}
                >
                  <FileText className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>View Report</p>
              </TooltipContent>
            </Tooltip>
            {canEdit(staff.profile_id) && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => onEdit(staff)}
                  >
                    <Edit className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Edit Staff</p>
                </TooltipContent>
              </Tooltip>
            )}
            {canDelete(staff.profile_id) && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                    onClick={() => onDelete(staff)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Delete Staff</p>
                </TooltipContent>
              </Tooltip>
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
    <TooltipProvider>
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
    </TooltipProvider>
  );
}
