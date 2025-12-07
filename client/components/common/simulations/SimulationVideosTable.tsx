"use client";

import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
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

import { VideoPicker } from "@/components/common/forms/VideoPicker";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Clock, Video } from "lucide-react";
import type { ContentItem } from "./SimulationContentTable";

export interface SimulationVideosTableProps {
  data: ContentItem[]; // Only video items
  // Video picker props
  videoMapping?: Record<
    string,
    { name: string; description: string; length_seconds: number }
  >;
  validVideoIds?: string[];
  selectedVideoIds?: string[];
  onVideoSelect?: (ids: string[]) => void;
  readonly?: boolean;
}

export function SimulationVideosTable({
  data,
  videoMapping = {},
  validVideoIds = [],
  selectedVideoIds = [],
  onVideoSelect,
  readonly = false,
}: SimulationVideosTableProps) {
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({});
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    [],
  );
  const [sorting, setSorting] = React.useState<SortingState>([
    { id: "position", desc: false },
  ]);

  // Filter to only videos
  const videoItems = React.useMemo(
    () => data.filter((item) => item.type === "video"),
    [data],
  );

  // Format video length
  const formatLength = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Columns definition
  const columns: ColumnDef<ContentItem>[] = React.useMemo(
    () => [
      {
        accessorKey: "title",
        size: 150,
        header: () => (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex flex-col items-center gap-1 cursor-help">
                <Video className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs">Name</span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>Video name</p>
            </TooltipContent>
          </Tooltip>
        ),
        cell: ({ row }) => {
          const item = row.original;
          return (
            <div className="flex flex-col w-[150px]">
              <span
                className="font-medium text-sm leading-tight whitespace-normal inline-flex items-center gap-1.5"
                style={{ wordBreak: "break-word", overflowWrap: "break-word" }}
              >
                <Video className="h-4 w-4 text-purple-600 flex-shrink-0" />
                {item.title}
                {item.isNew && (
                  <Badge
                    variant="outline"
                    className="bg-green-50 text-green-700 text-xs px-1 py-0 flex-shrink-0"
                  >
                    NEW
                  </Badge>
                )}
              </span>
            </div>
          );
        },
      },
      {
        id: "length",
        header: () => (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex flex-col items-center gap-1 cursor-help">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs">Length</span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>Video duration</p>
            </TooltipContent>
          </Tooltip>
        ),
        cell: ({ row }) => {
          const item = row.original;
          if (!item.length_seconds) {
            return <span className="text-xs text-muted-foreground">N/A</span>;
          }
          return (
            <div className="flex items-center justify-center">
              <span className="text-sm">
                {formatLength(item.length_seconds)}
              </span>
            </div>
          );
        },
      },
    ],
    [readonly],
  );

  const table = useReactTable({
    data: videoItems,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
    },
    initialState: {
      pagination: {
        pageSize: 10,
      },
    },
  });

  const tableRows = React.useMemo(() => {
    return table.getRowModel().rows;
  }, [table, videoItems.length, sorting, columnFilters]);

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Header with picker */}
        <div className="flex justify-between items-center">
          <div>
            <Label>Videos</Label>
            <p className="text-sm text-muted-foreground">
              Configure video-specific settings
            </p>
          </div>
          {!readonly && onVideoSelect && (
            <div className="w-[200px]">
              <VideoPicker
                videoMapping={videoMapping}
                validVideoIds={validVideoIds}
                selectedVideoIds={selectedVideoIds}
                onSelect={onVideoSelect}
                placeholder="Add videos..."
                hideSelectedChips={true}
                showLabel={false}
                buttonClassName="h-9"
              />
            </div>
          )}
        </div>

        {/* Table */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead
                      key={header.id}
                      className="text-center whitespace-normal"
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {tableRows?.length ? (
                tableRows.map((row) => (
                  <TableRow
                    key={row.id}
                    className="hover:bg-muted/30 transition-colors"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell
                        key={cell.id}
                        className="border-r px-3 py-2 text-center min-h-[60px]"
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
                    colSpan={columns.length}
                    className="h-24 text-center px-6"
                  >
                    No videos found.
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
