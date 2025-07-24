/**
 * LeaderboardTable.tsx
 * This component renders the performance data in a ranked table with filters
 * @AshokSaravanan222 & @siladiea
 * 07/20/2025
 */

import { DataTableColumnHeader } from "@/components/common/history/DataTableColumnHeader";
import { DataTableFacetedFilter } from "@/components/common/history/DataTableFacetedFilter";
import { DataTableViewOptions } from "@/components/common/history/DataTableViewOptions";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { X } from "lucide-react";
import { useMemo, useState } from "react";

export interface LeaderboardData {
  id: string;
  name: string;
  avgScore: number;
  passRate: number;
  simsCompleted: number;
  role?: string;
}

export interface LeaderboardTableProps {
  data: LeaderboardData[];
  currentUserId: string;
}

const getInitials = (name: string) =>
  name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase();

export default function LeaderboardTable({
  data,
  currentUserId,
}: LeaderboardTableProps) {
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [sorting, setSorting] = useState<SortingState>([
    { id: "avgScore", desc: true }, // Default sort by average score descending
  ]);

  // Create filter options
  const roleOptions = useMemo(() => {
    const uniqueRoles = [
      ...new Set(data.map((user) => user.role).filter(Boolean)),
    ];
    return uniqueRoles.map((role) => ({
      value: role!,
      label: role!.charAt(0).toUpperCase() + role!.slice(1),
    }));
  }, [data]);

  const scoreRangeOptions = useMemo(
    () => [
      {
        value: "excellent",
        label: "Excellent (80%+)",
      },
      {
        value: "good",
        label: "Good (70-79%)",
      },
      {
        value: "needs-improvement",
        label: "Needs Improvement (<70%)",
      },
    ],
    []
  );

  // Define columns
  const columns = useMemo<ColumnDef<LeaderboardData>[]>(
    () => [
      {
        id: "rank",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Rank" />
        ),
        cell: ({ row }) => {
          // Since we can't access the table instance here, we'll calculate rank based on original data order
          // The ranking will be handled by the default sorting
          return <div className="font-bold text-lg w-[80px]">-</div>;
        },
        enableSorting: false,
      },
      {
        accessorKey: "name",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="User" />
        ),
        cell: ({ row }) => {
          const user = row.original;
          return (
            <div className="flex items-center gap-3">
              <Avatar
                className="h-9 w-9 outline outline-muted-foreground"
                style={{ outlineWidth: "1px", outlineStyle: "solid" }}
              >
                <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
              </Avatar>
              <span className="font-medium">{user.name}</span>
              {user.id === currentUserId && (
                <Badge variant="default">You</Badge>
              )}
            </div>
          );
        },
        filterFn: (row, _, value) => {
          const name = row.getValue("name") as string;
          return name.toLowerCase().includes(value.toLowerCase());
        },
      },
      {
        accessorKey: "role",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="Role"
            className="justify-end"
          />
        ),
        cell: ({ row }) => {
          const role = row.getValue("role") as string;
          return (
            <div className="text-right">
              <Badge variant="outline" className="text-xs">
                {role || "Unknown"}
              </Badge>
            </div>
          );
        },
        filterFn: (row, _, value) => {
          const role = row.getValue("role") as string;
          return value.includes(role);
        },
      },
      {
        accessorKey: "avgScore",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="Avg. Score"
            className="justify-end"
          />
        ),
        cell: ({ row }) => {
          const score = row.getValue("avgScore") as number;
          return <div className="text-right font-semibold">{score}%</div>;
        },
        filterFn: (row, _, value) => {
          const score = row.getValue("avgScore") as number;

          if (score >= 80) {
            return value.includes("excellent");
          } else if (score >= 70) {
            return value.includes("good");
          } else {
            return value.includes("needs-improvement");
          }
        },
        sortingFn: "basic",
      },
      {
        accessorKey: "passRate",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="Pass Rate"
            className="justify-end"
          />
        ),
        cell: ({ row }) => {
          const passRate = row.getValue("passRate") as number;
          return <div className="text-right">{passRate}%</div>;
        },
        sortingFn: "basic",
      },
      {
        accessorKey: "simsCompleted",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="Sims Completed"
            className="justify-end"
          />
        ),
        cell: ({ row }) => {
          const simsCompleted = row.getValue("simsCompleted") as number;
          return <div className="text-right">{simsCompleted}</div>;
        },
        sortingFn: "basic",
      },
    ],
    [currentUserId]
  );

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnVisibility,
      columnFilters,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  });

  if (data.length === 0) {
    return (
      <div className="rounded-md border p-8 text-center">
        <p className="text-muted-foreground">No users found in this cohort.</p>
      </div>
    );
  }

  // Check if any filters are active
  const isFiltered = table.getState().columnFilters.length > 0;

  const nameColumn = table.getColumn("name");
  const roleColumn = table.getColumn("role");
  const avgScoreColumn = table.getColumn("avgScore");

  return (
    <div className="space-y-4">
      {/* Toolbar with filters */}
      <div className="flex items-center justify-between">
        <div className="flex flex-1 items-center space-x-2 flex-wrap">
          <div className="mb-2">
            <Input
              placeholder="Search users by name..."
              value={(nameColumn?.getFilterValue() as string) ?? ""}
              onChange={(event) =>
                nameColumn?.setFilterValue(event.target.value)
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

            {/* Score Range Filter */}
            {avgScoreColumn && scoreRangeOptions.length > 0 && (
              <DataTableFacetedFilter
                column={avgScoreColumn}
                title="Score Range"
                options={scoreRangeOptions}
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
          <DataTableViewOptions table={table} />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row, index) => (
                <TableRow
                  key={row.id}
                  className={
                    row.original.id === currentUserId ? "bg-muted/50" : ""
                  }
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {cell.column.id === "rank" ? (
                        <div className="font-bold text-lg w-[80px]">
                          {index + 1}
                        </div>
                      ) : (
                        flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
