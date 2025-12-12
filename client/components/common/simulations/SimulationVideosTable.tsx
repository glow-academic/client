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

import { GenericPicker } from "@/components/common/forms/GenericPicker";
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
              <GenericPicker
                items={videoMapping}
                itemIds={validVideoIds}
                selectedIds={selectedVideoIds}
                onSelect={onVideoSelect}
                getId={(item) => (item as unknown as { id: string }).id}
                getLabel={(item) => item.name || ""}
                getSearchText={(item) => `${item.name} ${item.description || ""}`}
                renderPreview={(item) => {
                  const formatLength = (seconds: number) => {
                    const mins = Math.floor(seconds / 60);
                    const secs = seconds % 60;
                    return `${mins}:${secs.toString().padStart(2, "0")}`;
                  };
                  return (
                    <div className="grid gap-2">
                      <h4 className="font-medium leading-none">{item.name || "No video selected"}</h4>
                      <div className="text-sm text-muted-foreground">
                        {item.description || "No description available"}
                      </div>
                      {item.length_seconds && (
                        <div className="text-xs text-muted-foreground mt-1">
                          Length: {formatLength(item.length_seconds)}
                        </div>
                      )}
                    </div>
                  );
                }}
                renderItem={(item, _isSelected) => {
                  const formatLength = (seconds: number) => {
                    const mins = Math.floor(seconds / 60);
                    const secs = seconds % 60;
                    return `${mins}:${secs.toString().padStart(2, "0")}`;
                  };
                  return (
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <Video className="h-4 w-4 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="truncate">{item.name}</div>
                          {item.description && (
                            <div className="mt-1 text-xs text-muted-foreground truncate group-data-[selected=true]:text-primary-foreground group-data-[highlighted=true]:text-primary-foreground">
                              {item.description}
                            </div>
                          )}
                          {item.length_seconds && (
                            <div className="mt-1 text-xs text-muted-foreground group-data-[selected=true]:text-primary-foreground group-data-[highlighted=true]:text-primary-foreground">
                              {formatLength(item.length_seconds)}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                }}
                placeholder="Add videos..."
                multiSelect={true}
                hideSelectedChips={true}
                buttonClassName="h-9 w-full"
                groupHeading="Videos"
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
