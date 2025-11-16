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
  getPaginationRowModel,
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

import type {
  CreateStaffDataOut,
  ProfileListItem,
  SearchStaffOut,
} from "@/app/(main)/management/staff/page";
import { DataTableColumnHeader } from "@/components/common/table/DataTableColumnHeader";
import { DataTablePagination } from "@/components/common/table/DataTablePagination";
import type {
  BulkCreateOrUpdateStaffAction,
  ProcessCSVAction,
  SearchStaffAction,
} from "@/components/staff/Staff";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Clock,
  Edit,
  FileText,
  Shield,
  Trash2,
  User as UserIcon,
  UserMinus,
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
    (now.getTime() - date.getTime()) / (1000 * 60),
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
  departmentMapping: Record<
    string,
    { name: string; description?: string | null }
  >;
  roleOptions: { value: string; label: string }[];
  cohortOptions: { value: string; label: string }[];
  lastActiveOptions: { value: string; label: string }[];
  isRefreshing: boolean;
  onRefresh: () => void;
  // Scope props - when provided, delete becomes "remove from relationship"
  cohortId?: string; // When provided, bulk delete removes from cohort (does NOT delete profile)
  departmentId?: string; // When provided, bulk delete removes from department (does NOT delete profile)
  // Scoped arrays for staff creation
  cohortIds?: string[];
  departmentIds?: string[];
  // New props for actions & selection
  selectedStaffIds: string[];
  onStaffSelect: (profileId: string, checked: boolean) => void;
  onSelectAll: (checked: boolean, visibleRowIds?: string[]) => void;
  onCreate: (
    stagedProfiles?: Array<{
      profileId: string;
      firstName?: string;
      lastName?: string;
      alias?: string;
      role?: string;
    }>,
  ) => void;
  onPreview: (staff: ProfileListItem) => void;
  onEdit: (staff: ProfileListItem) => void;
  onDelete: (staff: ProfileListItem) => void;
  onRemoveFromCohort?: (staff: ProfileListItem) => void;
  onBulkEdit: () => void;
  onBulkDelete: () => void;
  canDelete: (profileId: string) => boolean;
  deletableCount: number;
  canEdit: (profileId: string) => boolean;
  editableCount: number;
  searchStaffAction?: SearchStaffAction;
  processCSVAction?: ProcessCSVAction;
  bulkCreateOrUpdateStaffAction?: BulkCreateOrUpdateStaffAction;
  initialCreateStaffData?: CreateStaffDataOut;
  initialSearchData?: SearchStaffOut;
}

export function StaffDataTable({
  data,
  cohortMapping,
  departmentMapping,
  roleOptions,
  cohortOptions,
  lastActiveOptions,
  isRefreshing,
  onRefresh,
  cohortId,
  departmentId,
  cohortIds,
  departmentIds,
  selectedStaffIds,
  onStaffSelect,
  onSelectAll,
  onCreate,
  onPreview,
  onEdit,
  onDelete,
  onRemoveFromCohort,
  onBulkEdit,
  onBulkDelete,
  canDelete,
  deletableCount,
  canEdit,
  editableCount,
  searchStaffAction,
  processCSVAction,
  bulkCreateOrUpdateStaffAction,
  initialCreateStaffData,
  initialSearchData,
}: StaffDataTableProps) {
  const [rowSelection, setRowSelection] = React.useState({});

  // Set column visibility based on page context
  const initialColumnVisibility = React.useMemo<VisibilityState>(() => {
    const base: VisibilityState = {
      name: false,
      active: false,
      lastActive: false,
    };

    if (cohortId) {
      // Cohorts page: hide department_ids and cohort_ids, show total_requests
      return {
        ...base,
        department_ids: false,
        cohort_ids: false,
        total_requests: true,
      };
    } else if (departmentId) {
      // Departments page: hide department_ids, show cohort_ids and total_requests
      return {
        ...base,
        department_ids: false,
        cohort_ids: true,
        total_requests: true,
      };
    } else {
      // Staff page: hide cohort_ids, show department_ids and total_requests
      return {
        ...base,
        department_ids: true,
        cohort_ids: false,
        total_requests: true,
      };
    }
  }, [cohortId, departmentId]);

  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>(initialColumnVisibility);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    [],
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
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm">
                      {staff.first_name} {staff.last_name}
                    </p>
                    {(staff as ProfileListItem & { isStaged?: boolean })
                      .isStaged && (
                      <Badge
                        variant="outline"
                        className="text-xs bg-blue-50 text-blue-700 border-blue-200"
                      >
                        New
                      </Badge>
                    )}
                  </div>
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
        id: "name",
        accessorFn: (row: ProfileListItem) =>
          `${row.first_name} ${row.last_name} ${row.alias}`.toLowerCase(),
        header: "Search",
        cell: () => null,
        enableHiding: false,
        enableSorting: false,
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
        id: "active",
        accessorFn: (row: ProfileListItem) => (row.active ? "true" : "false"),
        header: "Active",
        cell: () => null,
        enableHiding: false,
        enableSorting: false,
      },
      {
        id: "cohort_ids",
        accessorFn: (row: ProfileListItem) => row.cohort_ids ?? [],
        filterFn: (row, _, value: string[]) => {
          const rowIds = (row.getValue("cohort_ids") as string[]) ?? [];
          return value.some((v) => rowIds.includes(v));
        },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Cohorts" />
        ),
        cell: ({ row }) => {
          const staff = row.original;
          const cohortIds = staff.cohort_ids;

          if (!cohortIds.length) {
            return <span className="text-xs text-muted-foreground">None</span>;
          }

          return (
            <div className="flex gap-1 overflow-x-auto max-w-[150px] [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              {cohortIds.map((id) => (
                <Badge
                  key={id}
                  className="text-xs bg-blue-100 text-blue-800 hover:bg-blue-100 whitespace-nowrap flex-shrink-0"
                >
                  {cohortMapping[id]?.name || id}
                </Badge>
              ))}
            </div>
          );
        },
      },
      {
        id: "department_ids",
        accessorFn: (row: ProfileListItem) => row.department_ids ?? [],
        filterFn: (row, _, value: string[]) => {
          const rowIds = (row.getValue("department_ids") as string[]) ?? [];
          return value.some((v) => rowIds.includes(v));
        },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Departments" />
        ),
        cell: ({ row }) => {
          const staff = row.original;
          const departmentIds = staff.department_ids;

          if (!departmentIds.length) {
            return <span className="text-xs text-muted-foreground">None</span>;
          }

          return (
            <div className="flex gap-1 overflow-x-auto max-w-[150px] [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              {departmentIds.map((id) => (
                <Badge
                  key={id}
                  className="text-xs bg-blue-100 text-blue-800 hover:bg-blue-100 whitespace-nowrap flex-shrink-0"
                >
                  {departmentMapping[id]?.name || id}
                </Badge>
              ))}
            </div>
          );
        },
      },
      {
        id: "lastActive",
        accessorFn: (row: ProfileListItem) => {
          const lastActive = row.last_active;
          if (!lastActive) return "never";

          const date = new Date(lastActive);
          const now = new Date();
          const diffInDays = Math.floor(
            (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24),
          );

          if (diffInDays < 7) return "recent";
          if (diffInDays <= 30) return "moderate";
          return "old";
        },
        header: "Last Active Category",
        cell: () => null,
        enableHiding: false,
        enableSorting: false,
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
      {
        id: "requests",
        accessorFn: (row) => row.requests_in_last_day ?? 0,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Requests / Day" />
        ),
        cell: ({ row }) => {
          const staff = row.original;
          const used = staff.requests_in_last_day ?? 0;
          const limit = staff.requests_per_day;
          const limitText =
            limit === null || limit === undefined ? "∞" : String(limit);
          return (
            <div className="flex flex-col items-center">
              <span className="text-sm font-medium">
                {used}/{limitText}
              </span>
              <span className="text-xs text-muted-foreground">used</span>
            </div>
          );
        },
        enableSorting: true,
        enableColumnFilter: false,
      },
      {
        id: "total_requests",
        accessorFn: (row) => row.total_requests ?? 0,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Total Requests" />
        ),
        cell: ({ row }) => {
          const staff = row.original;
          const total = staff.total_requests ?? 0;
          return (
            <div className="flex items-center justify-center">
              <span className="text-sm font-medium">{total}</span>
            </div>
          );
        },
        enableSorting: true,
        enableColumnFilter: false,
      },
    ],
    [cohortMapping, departmentMapping],
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
            data-testid="checkbox-select-all"
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
            data-testid="checkbox-select-staff"
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
                  data-testid="btn-preview-staff"
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
                    data-testid="btn-edit-staff"
                  >
                    <Edit className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Edit Staff</p>
                </TooltipContent>
              </Tooltip>
            )}
            {/* Remove from Cohort - show when cohortId provided */}
            {cohortId && onRemoveFromCohort && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                    onClick={() => onRemoveFromCohort(staff)}
                  >
                    <UserMinus className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Remove from Cohort</p>
                </TooltipContent>
              </Tooltip>
            )}
            {/* Only show delete when NOT scoped (cohortId/departmentId) - scoped views use "remove" via bulk actions */}
            {!cohortId && !departmentId && canDelete(staff.profile_id) && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                    onClick={() => onDelete(staff)}
                    data-testid="btn-delete-staff"
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
      (c) => c.id !== "select" && c.id !== "actions",
    );
    return [checkboxColumn, ...filtered, actionsColumn];
  }, [
    columns,
    onSelectAll,
    onRemoveFromCohort,
    selectedStaffIds,
    onStaffSelect,
    onPreview,
    onEdit,
    onDelete,
    canDelete,
    canEdit,
    cohortId,
    departmentId,
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
    getPaginationRowModel: getPaginationRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    initialState: {
      pagination: {
        pageSize: 10,
      },
    },
  });

  return (
    <TooltipProvider>
      <div className="space-y-2">
        <StaffDataTableToolbar
          table={table}
          roleOptions={roleOptions}
          cohortOptions={cohortOptions}
          lastActiveOptions={lastActiveOptions}
          isRefreshing={isRefreshing}
          onRefresh={onRefresh}
          selectedCount={selectedStaffIds.length}
          onBulkDelete={onBulkDelete}
          onBulkEdit={onBulkEdit}
          onCreate={onCreate}
          deletableCount={deletableCount}
          editableCount={editableCount}
          cohortId={cohortId}
          {...(searchStaffAction && { searchStaffAction })}
          {...(processCSVAction && { processCSVAction })}
          {...(bulkCreateOrUpdateStaffAction && {
            bulkCreateOrUpdateStaffAction,
          })}
          {...(initialCreateStaffData && { initialCreateStaffData })}
          {...(initialSearchData && { initialSearchData })}
          departmentId={departmentId}
          {...(cohortIds && cohortIds.length > 0 && { cohortIds })}
          {...(departmentIds && departmentIds.length > 0 && { departmentIds })}
        />
        <div className="rounded-md border overflow-x-auto" data-testid="staff-table">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    // Skip rendering hidden columns
                    if (!header.column.getIsVisible()) return null;

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
                              header.getContext(),
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
                    data-testid="staff-row"
                    data-profile-id={row.original.profile_id}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell
                        key={cell.id}
                        className="border-r px-3 py-2 text-center"
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
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
        <DataTablePagination table={table} />
      </div>
    </TooltipProvider>
  );
}
