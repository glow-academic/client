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
} from "@/app/(main)/system/staff/page";
import { DataTableColumnHeader } from "@/components/common/table/DataTableColumnHeader";
import { DataTableFacetedFilter } from "@/components/common/table/DataTableFacetedFilter";
import { DataTablePagination } from "@/components/common/table/DataTablePagination";
import { DataTableViewOptions } from "@/components/common/table/DataTableViewOptions";
import type {
  BulkCreateOrUpdateStaffAction,
  ProcessCSVAction,
  SearchStaffAction,
} from "@/components/staff/Staff";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

import { Input } from "@/components/ui/input";
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
  RefreshCw,
  Shield,
  Trash2,
  User as UserIcon,
  UserMinus,
  X,
} from "lucide-react";
import { CreateStaffButton } from "./CreateStaffButton";

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
    }>
  ) => void;
  onPreview: (staff: ProfileListItem) => void;
  onEdit: (staff: ProfileListItem) => void;
  onDelete: (staff: ProfileListItem) => void;
  onRemoveFromCohort?: (staff: ProfileListItem) => void;
  onRemoveFromDepartment?: (staff: ProfileListItem) => void;
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
  onRemoveFromDepartment,
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

  // Set column visibility based on page context - simplified, no useMemo needed
  const baseVisibility: VisibilityState = {
    name: false,
    active: false,
    lastActive: false,
  };

  const initialColumnVisibility: VisibilityState = cohortId
    ? {
        ...baseVisibility,
        department_ids: false,
        cohort_ids: false,
        total_requests: true,
      }
    : departmentId
      ? {
          ...baseVisibility,
          department_ids: false,
          cohort_ids: true,
          total_requests: true,
        }
      : {
          ...baseVisibility,
          department_ids: true,
          cohort_ids: false,
          total_requests: true,
        };

  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>(initialColumnVisibility);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    []
  );
  const [sorting, setSorting] = React.useState<SortingState>([
    { id: "last_active", desc: true }, // Default sort by last active descending
  ]);

  // Transform mappings for modals - simplified, computed directly
  const createStaffData = initialCreateStaffData;
  const departmentMappingForModals: Record<
    string,
    { name: string; description: string }
  > = {};
  if (createStaffData?.department_mapping) {
    Object.entries(createStaffData.department_mapping).forEach(([id, dept]) => {
      if (dept && typeof dept === "object" && "name" in dept) {
        departmentMappingForModals[id] = {
          name: String(dept.name),
          description: String(dept.description || ""),
        };
      }
    });
  }

  const cohortMappingForModals: Record<
    string,
    { name: string; description: string }
  > = {};
  if (createStaffData?.cohort_mapping) {
    Object.entries(createStaffData.cohort_mapping).forEach(([id, cohort]) => {
      if (cohort && typeof cohort === "object" && "name" in cohort) {
        cohortMappingForModals[id] = {
          name: String(cohort.name),
          description: String(cohort.description || ""),
        };
      }
    });
  }

  const validDepartmentIds = Object.keys(departmentMappingForModals);
  const validCohortIds = Object.keys(cohortMappingForModals);

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
            (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
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
        enableColumnFilter: true,
        filterFn: (row, _, value: string[]) => {
          const total = row.getValue("total_requests") as number;
          if (value.length === 0) return true;
          return value.some((category) => {
            if (category === "0") return total === 0;
            if (category === "1-10") return total >= 1 && total <= 10;
            if (category === "11-50") return total >= 11 && total <= 50;
            if (category === "51-100") return total >= 51 && total <= 100;
            if (category === "100+") return total > 100;
            return false;
          });
        },
      },
    ],
    [cohortMapping, departmentMapping]
  );

  // Build columns with checkbox + actions
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
            {/* Remove from Department - show when departmentId provided */}
            {departmentId && onRemoveFromDepartment && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                    onClick={() => onRemoveFromDepartment(staff)}
                  >
                    <UserMinus className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Remove from Department</p>
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
      (c) => c.id !== "select" && c.id !== "actions"
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
    onRemoveFromDepartment,
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
        pageSize: 100,
      },
    },
  });

  // Toolbar state
  const isFiltered = table.getState().columnFilters.length > 0;
  const nameColumn = table.getColumn("name");
  const roleColumn = table.getColumn("role");
  const lastActiveColumn = table.getColumn("lastActive");
  const cohortIdsColumn = table.getColumn("cohort_ids");
  const departmentIdsColumn = table.getColumn("department_ids");
  const totalRequestsColumn = table.getColumn("total_requests");
  const selectedCount = selectedStaffIds.length;
  const isScoped = !!(departmentIds?.length || cohortIds?.length);

  return (
    <TooltipProvider>
      <div className="space-y-2">
        {/* Inlined Toolbar */}
        <div
          className="flex items-center justify-between"
          data-testid="staff-toolbar"
        >
          <div className="flex flex-1 items-center space-x-2 flex-wrap">
            <div className="mb-2 w-full md:w-auto">
              <Input
                placeholder="Search staff by name or alias..."
                value={(nameColumn?.getFilterValue() as string) ?? ""}
                onChange={(event) =>
                  nameColumn?.setFilterValue(event.target.value)
                }
                className="h-8 w-full md:w-[150px] lg:w-[250px]"
                data-testid="staff-search"
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

              {/* Last Active Filter */}
              {lastActiveColumn && lastActiveOptions.length > 0 && (
                <DataTableFacetedFilter
                  column={lastActiveColumn}
                  title="Last Active"
                  options={lastActiveOptions}
                />
              )}

              {/* Requests Filter - show when cohortId provided (cohorts page) */}
              {cohortId && totalRequestsColumn && (
                <DataTableFacetedFilter
                  column={totalRequestsColumn}
                  title="Requests"
                  options={[
                    { value: "0", label: "0" },
                    { value: "1-10", label: "1-10" },
                    { value: "11-50", label: "11-50" },
                    { value: "51-100", label: "51-100" },
                    { value: "100+", label: "100+" },
                  ]}
                />
              )}

              {/* Cohort Filter - show when departmentId provided (departments page), hide when cohortId provided (cohorts page) */}
              {departmentId &&
                !cohortId &&
                cohortIdsColumn &&
                cohortOptions.length > 0 && (
                  <DataTableFacetedFilter
                    column={cohortIdsColumn}
                    title="Cohort"
                    options={cohortOptions}
                  />
                )}

              {/* Departments Filter - show when no scope (staff page), hide when cohortId or departmentId provided */}
              {!cohortId && !departmentId && departmentIdsColumn && (
                <DataTableFacetedFilter
                  column={departmentIdsColumn}
                  title="Department"
                  options={Object.entries(departmentMapping).map(
                    ([id, item]) => ({
                      value: id,
                      label: item.name,
                    })
                  )}
                />
              )}

              {isFiltered && (
                <Button
                  type="button"
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

          <div className="flex items-center space-x-2 mb-2">
            {/* Create Staff Button - only show when no rows are selected */}
            {onCreate && selectedCount === 0 && (
              <CreateStaffButton
                onCreate={onCreate}
                {...(searchStaffAction !== undefined && {
                  searchStaffAction,
                })}
                {...(processCSVAction !== undefined && {
                  processCSVAction,
                })}
                {...(bulkCreateOrUpdateStaffAction !== undefined && {
                  bulkCreateOrUpdateStaffAction,
                })}
                {...(initialCreateStaffData !== undefined &&
                  initialCreateStaffData !== null && {
                    initialCreateStaffData,
                  })}
                {...(initialSearchData !== undefined &&
                  initialSearchData !== null && {
                    initialSearchData,
                  })}
                {...(cohortIds !== undefined && { cohortIds })}
                {...(departmentIds !== undefined && { departmentIds })}
                validDepartmentIds={validDepartmentIds}
                validCohortIds={validCohortIds}
                {...(isScoped !== undefined && { isScoped })}
              />
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
                  data-testid="btn-bulk-edit-staff"
                >
                  Bulk Edit {editableCount} of {selectedCount}
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={onBulkDelete}
                  className="h-8"
                  data-testid="btn-bulk-delete-staff"
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

            <DataTableViewOptions
              table={table}
              hiddenColumns={
                cohortId || departmentId
                  ? ["cohort_ids", "department_ids"]
                  : ["cohort_ids"]
              }
            />
          </div>
        </div>

        <div
          className="rounded-md border overflow-x-auto"
          data-testid="staff-table"
        >
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
        <DataTablePagination table={table} staff={true} />
      </div>
    </TooltipProvider>
  );
}
