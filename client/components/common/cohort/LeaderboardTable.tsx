/**
 * LeaderboardTable.tsx
 * This component renders the performance data in a ranked table with filters
 * @AshokSaravanan222 & @siladiea
 * 07/20/2025
 */

import { DataTableColumnHeader } from "@/components/common/history/DataTableColumnHeader";
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
  highestScoreAvg: number;
  timeSpentMinutes: number;
  messagesPerSession: number;
  totalAttempts: number;
  perfectScoreCount: number;
  quickestPassMinutes: number;
  personaResponseSeconds: number;
  improvementRatePerDay: number;
  percentile?: number; // Optional since we're no longer using it
  role?: string; // Optional since we're no longer displaying it
}

export interface LeaderboardTableProps {
  data: LeaderboardData[];
  currentUserId: string;
  onViewReport?: (profileId: string) => void;
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
  onViewReport,
}: LeaderboardTableProps) {
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({
    improvementRatePerDay: false,
    personaResponseSeconds: false,
    quickestPassMinutes: false,
  });
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [sorting, setSorting] = useState<SortingState>([
    { id: "highestScoreAvg", desc: true }, // Default sort by highest score descending
  ]);

  // Define columns
  const columns = useMemo<ColumnDef<LeaderboardData>[]>(
    () => [
      {
        id: "rank",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Rank" />
        ),
        cell: () => {
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
        accessorKey: "highestScoreAvg",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="Highest Score"
            className="justify-end"
          />
        ),
        cell: ({ row }) => {
          const score = row.getValue("highestScoreAvg") as number;
          return <div className="text-right">{score}%</div>;
        },
        sortingFn: "basic",
      },
      {
        accessorKey: "timeSpentMinutes",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="Time Spent"
            className="justify-end"
          />
        ),
        cell: ({ row }) => {
          const v = row.getValue("timeSpentMinutes") as number;
          return <div className="text-right">{v} min</div>;
        },
        sortingFn: "basic",
      },
      {
        accessorKey: "messagesPerSession",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="Msgs / Session"
            className="justify-end"
          />
        ),
        cell: ({ row }) => {
          const v = row.getValue("messagesPerSession") as number;
          return <div className="text-right">{v}</div>;
        },
        sortingFn: "basic",
      },
      {
        accessorKey: "perfectScoreCount",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="Perfect Scores"
            className="justify-end"
          />
        ),
        cell: ({ row }) => {
          const v = row.getValue("perfectScoreCount") as number;
          return <div className="text-right">{v}</div>;
        },
        sortingFn: "basic",
      },
      {
        accessorKey: "quickestPassMinutes",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="Quickest Pass"
            className="justify-end"
          />
        ),
        cell: ({ row }) => {
          const v = row.getValue("quickestPassMinutes") as number;
          return <div className="text-right">{v} min</div>;
        },
        sortingFn: "basic",
      },
      {
        accessorKey: "personaResponseSeconds",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="Response Times"
            className="justify-end"
          />
        ),
        cell: ({ row }) => {
          const v = row.getValue("personaResponseSeconds") as number;
          return <div className="text-right">{v}s</div>;
        },
        sortingFn: "basic",
      },
      {
        accessorKey: "improvementRatePerDay",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="Improvement/Day"
            className="justify-end"
          />
        ),
        cell: ({ row }) => {
          const v = row.getValue("improvementRatePerDay") as number;
          return <div className="text-right">{v}%</div>;
        },
        sortingFn: "basic",
      },
      {
        accessorKey: "totalAttempts",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="Attempts"
            className="justify-end"
          />
        ),
        cell: ({ row }) => {
          const v = row.getValue("totalAttempts") as number;
          return <div className="text-right">{v}</div>;
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

  // Check if any filters are active
  const isFiltered = table.getState().columnFilters.length > 0;

  const nameColumn = table.getColumn("name");

  if (data.length === 0) {
    return (
      <div className="rounded-md border p-8 text-center">
        <p className="text-muted-foreground">No users found in this cohort.</p>
      </div>
    );
  }

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
            {(() => {
              // Show all rows (no percentile filtering)
              const allRows = table.getRowModel().rows;
              return allRows;
            })().length ? (
              (() => {
                const allRows = table.getRowModel().rows;
                return allRows.map((row, index) => (
                  <TableRow
                    key={row.id}
                    className={`${
                      row.original.id === currentUserId ? "bg-muted/50" : ""
                    } ${onViewReport ? "hover:bg-muted/30 transition-colors cursor-pointer" : ""}`}
                    onClick={() => onViewReport?.(row.original.id)}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {cell.column.id === "rank" ? (
                          <div className="flex items-center gap-2 w-[120px]">
                            <span className="font-bold text-lg">
                              {index + 1}
                            </span>
                            {index < 3 ? (
                              <span
                                aria-label="medal"
                                title={
                                  index === 0
                                    ? "Gold"
                                    : index === 1
                                      ? "Silver"
                                      : "Bronze"
                                }
                              >
                                {index === 0 ? "🥇" : index === 1 ? "🥈" : "🥉"}
                              </span>
                            ) : null}
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
                ));
              })()
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
