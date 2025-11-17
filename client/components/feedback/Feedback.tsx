/**
 * Feedback.tsx
 * Used to look at feedback from users.
 * @AshokSaravanan222 & @siladiea
 * 07/08/2025
 */
"use client";

import type {
  BulkDeleteFeedbackIn,
  BulkDeleteFeedbackOut,
  FeedbackListOut,
} from "@/app/(main)/system/feedback/page";
import { DataTableColumnHeader } from "@/components/common/table/DataTableColumnHeader";
import { DataTableFacetedFilter } from "@/components/common/table/DataTableFacetedFilter";
import { DataTablePagination } from "@/components/common/table/DataTablePagination";
import { DataTableViewOptions } from "@/components/common/table/DataTableViewOptions";
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
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { RefreshCw, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { BulkDeleteFeedbackDialog } from "./BulkDeleteFeedbackDialog";

// Helper functions
const getFeedbackTypeVariant = (
  type: string,
): "destructive" | "default" | "secondary" | "outline" => {
  switch (type) {
    case "bug":
      return "destructive";
    case "feature":
      return "default";
    case "question":
      return "secondary";
    case "other":
      return "outline";
    default:
      return "default";
  }
};

const getFeedbackTypeIcon = (type: string): string => {
  switch (type) {
    case "bug":
      return "🐛";
    case "feature":
      return "✨";
    case "question":
      return "❓";
    case "other":
      return "📝";
    default:
      return "📝";
  }
};

export interface FeedbackProps {
  // Server-provided data (for server-side rendering)
  listData: FeedbackListOut;
  // Server actions (replaces useMutation)
  bulkDeleteFeedbackAction?: (
    input: BulkDeleteFeedbackIn,
  ) => Promise<BulkDeleteFeedbackOut>;
}

export default function Feedback({
  listData: serverListData,
  bulkDeleteFeedbackAction,
}: FeedbackProps) {
  const router = useRouter();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);

  // Table state
  const [rowSelection, setRowSelection] = useState({});
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [sorting, setSorting] = useState<SortingState>([
    { id: "created_at", desc: true },
  ]);

  // Use server-provided data directly
  const feedbackData = serverListData;

  // Extract data from V3 response
  const feedback = useMemo(
    () => feedbackData?.feedback || [],
    [feedbackData?.feedback],
  );

  // Filter options (inline)
  const typeOptions = useMemo(
    () => [
      { value: "bug", label: "🐛 Bug" },
      { value: "feature", label: "✨ Feature" },
      { value: "question", label: "❓ Question" },
      { value: "other", label: "📝 Other" },
    ],
    [],
  );

  const profileOptions = useMemo(() => {
    const uniqueAuthors = new Set(
      feedback.map((f) => f.author_name).filter(Boolean),
    );
    return Array.from(uniqueAuthors).map((name) => ({
      value: name,
      label: name,
    }));
  }, [feedback]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      router.refresh();
      toast.success("Feedback data refreshed");
    } catch {
      toast.error("Failed to refresh feedback data");
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleBulkDelete = () => {
    setShowBulkDeleteDialog(true);
  };

  const handleBulkDeleteSuccess = () => {
    // The query will be invalidated by the mutation hook
    // Dialog will close automatically after successful deletion
  };

  // Define columns with rich visual styling
  const columns = useMemo<ColumnDef<(typeof feedback)[number]>[]>(
    () => [
      {
        accessorKey: "type",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Type" />
        ),
        cell: ({ row }) => {
          const type = row.getValue("type") as string;
          return (
            <div className="flex justify-center">
              <Badge variant={getFeedbackTypeVariant(type)}>
                {getFeedbackTypeIcon(type)} {type.toUpperCase()}
              </Badge>
            </div>
          );
        },
        enableSorting: true,
        enableHiding: false,
        enableColumnFilter: true,
        filterFn: (row, _, value) => {
          if (!value || value.length === 0) return true;
          return value.includes(row.getValue("type"));
        },
      },
      {
        accessorKey: "message",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Message" />
        ),
        cell: ({ row }) => (
          <div className="max-w-lg text-left mx-auto text-sm whitespace-normal break-words">
            {row.getValue("message") ?? "N/A"}
          </div>
        ),
        enableSorting: true,
        enableHiding: false,
      },
      {
        accessorKey: "author_name",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Author" />
        ),
        cell: ({ row }) => {
          const feedbackItem = row.original;
          return (
            <div className="flex flex-col">
              <span className="font-medium text-sm">
                {feedbackItem.author_name}
              </span>
              {feedbackItem.author_alias && (
                <span className="text-xs text-muted-foreground">
                  {feedbackItem.author_alias}
                </span>
              )}
            </div>
          );
        },
        enableSorting: true,
        enableHiding: false,
        enableColumnFilter: true,
        filterFn: (row, _, value) => {
          if (!value || value.length === 0) return true;
          return value.includes(row.getValue("author_name"));
        },
      },
      {
        accessorKey: "created_at",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Created At" />
        ),
        cell: ({ row }) => {
          const date = row.getValue("created_at") as string;
          return (
            <div className="text-sm text-center">
              {new Date(date).toLocaleString("en-US", {
                year: "numeric",
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </div>
          );
        },
        enableSorting: true,
        enableHiding: false,
      },
    ],
    [],
  );

  // Create table instance
  const table = useReactTable({
    data: feedback,
    columns,
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
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    initialState: {
      pagination: {
        pageSize: 10,
      },
    },
  });

  // Get column references for toolbar
  const messageColumn = table.getColumn("message");
  const typeColumn = table.getColumn("type");
  const authorColumn = table.getColumn("author_name");
  const idColumn = table.getColumn("feedback_id");
  const isFiltered = table.getState().columnFilters.length > 0;

  const idOptions = useMemo(() => {
    if (!idColumn) return [] as { value: string; label: string }[];
    const uniqueIds = new Set<string>();
    table.getFilteredRowModel().rows.forEach((row) => {
      uniqueIds.add(
        String(
          (row as { original: { feedback_id: number } }).original.feedback_id,
        ),
      );
    });
    return Array.from(uniqueIds)
      .sort((a, b) => {
        const na = Number(a);
        const nb = Number(b);
        if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
        return a.localeCompare(b);
      })
      .map((id) => ({
        value: id,
        label: `ID: ${id}`,
      }));
  }, [table, idColumn]);

  return (
    <>
      <div className="space-y-4">
        {/* Toolbar */}
        <div className="flex items-center justify-between">
          <div className="flex flex-1 items-center space-x-2 flex-wrap">
            <div className="mb-2 w-full md:w-auto">
              <Input
                placeholder="Search feedback or author..."
                value={(messageColumn?.getFilterValue() as string) ?? ""}
                onChange={(event) =>
                  messageColumn?.setFilterValue(event.target.value)
                }
                className="h-8 w-full md:w-[150px] lg:w-[250px]"
              />
            </div>

            <div className="flex items-center space-x-2 flex-wrap mb-2">
              {idColumn && idOptions.length > 0 && (
                <DataTableFacetedFilter
                  column={idColumn}
                  title="ID"
                  options={idOptions}
                />
              )}

              {typeColumn && typeOptions.length > 0 && (
                <DataTableFacetedFilter
                  column={typeColumn}
                  title="Type"
                  options={typeOptions}
                />
              )}

              {authorColumn && profileOptions.length > 0 && (
                <DataTableFacetedFilter
                  column={authorColumn}
                  title="Author"
                  options={profileOptions}
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

          <div className="flex items-center space-x-2 mb-2">
            {/* Bulk Delete Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleBulkDelete}
              className="h-8 px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="h-4 w-4" />
            </Button>

            {/* Refresh Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing}
            >
              <RefreshCw
                className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
              />
            </Button>

            <DataTableViewOptions table={table} />
          </div>
        </div>

        {/* Table */}
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id} className="h-8">
                  {headerGroup.headers.map((header) => {
                    return (
                      <TableHead
                        key={header.id}
                        colSpan={header.colSpan}
                        className={`border-r py-1 text-xs text-center ${
                          header.id === "select" ? "w-12" : ""
                        } ${header.column.getCanSort() ? "pl-4" : ""}`}
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
                    className="h-6 hover:bg-muted/30 transition-colors"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell
                        key={cell.id}
                        className={`border-r px-2 py-1 ${
                          cell.column.id === "select" ? "w-12 text-center" : ""
                        } ${
                          cell.column.id === "message"
                            ? "text-left align-top"
                            : "text-center"
                        }`}
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
                    No feedback found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        <DataTablePagination table={table} />
      </div>

      {/* Bulk Delete Dialog */}
      <BulkDeleteFeedbackDialog
        {...(bulkDeleteFeedbackAction && { bulkDeleteFeedbackAction })}
        open={showBulkDeleteDialog}
        onOpenChange={setShowBulkDeleteDialog}
        feedback={feedback}
        onSuccess={handleBulkDeleteSuccess}
      />
    </>
  );
}
