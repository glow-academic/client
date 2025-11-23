/**
 * Videos.tsx
 * Used to display the videos page with table-based filtering and card layout.
 * @AshokSaravanan222 & @siladiea
 * 01/21/2025
 */
"use client";
import { Copy, Edit, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import type {
  DeleteVideoIn,
  DeleteVideoOut,
  DuplicateVideoIn,
  DuplicateVideoOut,
  VideosListOut,
} from "@/app/(main)/create/videos/page";
import { DataTableFacetedFilter } from "@/components/common/table/DataTableFacetedFilter";
import { DataTablePagination } from "@/components/common/table/DataTablePagination";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";

export interface VideosProps {
  // Server-provided data (for server-side rendering)
  listData: VideosListOut;
  // Server actions (replaces useMutation)
  duplicateVideoAction?: (
    input: DuplicateVideoIn
  ) => Promise<DuplicateVideoOut>;
  deleteVideoAction?: (input: DeleteVideoIn) => Promise<DeleteVideoOut>;
}

export function Videos({
  listData: serverListData,
  duplicateVideoAction,
  deleteVideoAction,
}: VideosProps) {
  const router = useRouter();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteItem, setDeleteItem] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState<string | null>(null);

  // Table state
  const [rowSelection, setRowSelection] = useState({});
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [sorting, setSorting] = useState<SortingState>([
    { id: "updated_at", desc: true },
  ]);

  // Use server-provided data directly
  const videosData = serverListData;

  // Extract data from response
  const videos = useMemo(() => videosData?.videos || [], [videosData?.videos]);

  // Use server-provided facet options directly (no client-side computation)
  const departmentOptions = useMemo(
    () =>
      (videosData?.department_options || [])
        .map((opt) => ({
          value: opt["value"] as string,
          label: opt["label"] as string,
        }))
        .filter((opt) => opt.value && opt.label),
    [videosData?.department_options]
  );

  // Format length_seconds to MM:SS
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Define table columns inline
  const columns: ColumnDef<(typeof videos)[number]>[] = useMemo(() => {
    return [
      {
        accessorKey: "name",
        header: "Name",
        cell: ({ row }) => {
          return (
            <div className="font-medium">
              {row.original.name || "Unnamed Video"}
            </div>
          );
        },
        filterFn: (row, id, value) => {
          const name = String(row.getValue(id)).toLowerCase();
          const desc = String(row.original.description).toLowerCase();
          const query = String(value).toLowerCase();
          return name.includes(query) || desc.includes(query);
        },
      },
      {
        accessorKey: "description",
        header: "Description",
        cell: ({ row }) => {
          return (
            <div className="text-sm text-muted-foreground line-clamp-2">
              {row.original.description || "No description"}
            </div>
          );
        },
      },
      {
        accessorKey: "length_seconds",
        header: "Length",
        cell: ({ row }) => {
          return (
            <div className="text-sm">
              {formatDuration(row.original.length_seconds)}
            </div>
          );
        },
      },
      {
        accessorKey: "updated_at",
        header: "Updated",
        cell: ({ row }) => {
          const date = new Date(row.original.updated_at);
          return (
            <div className="text-sm text-muted-foreground">
              {date.toLocaleDateString()}
            </div>
          );
        },
      },
      // Hidden faceting column for Departments (array of IDs)
      {
        id: "departments",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        accessorFn: (row: (typeof videos)[number]) => row.department_ids ?? [],
        filterFn: (row, _id, value: string[]) => {
          const rowIds = (row.getValue("departments") as string[]) ?? [];
          if (value.length === 0) return true;
          if (rowIds.length === 0) return true; // Show cross-department items when no filter
          return value.some((v) => rowIds.includes(v));
        },
      },
    ];
  }, []);

  // Create table instance
  const table = useReactTable({
    data: videos,
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

  // Memoize table rows
  const pageIndex = table.getState().pagination.pageIndex;
  const pageSize = table.getState().pagination.pageSize;
  const sortingKey = JSON.stringify(sorting);
  const columnFiltersKey = JSON.stringify(columnFilters);
  const tableRows = useMemo(() => {
    return table.getRowModel().rows;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortingKey, columnFiltersKey, videos.length, pageIndex, pageSize]);

  const handleDelete = async () => {
    if (!deleteItem || !deleteVideoAction) return;

    setIsDeleting(true);
    try {
      await deleteVideoAction({ body: { videoId: deleteItem.id } });
      toast.success("Video deleted successfully");
      router.refresh();
    } catch {
      toast.error("Failed to delete video");
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
      setDeleteItem(null);
    }
  };

  const handleDuplicate = async (videoId: string, videoName: string) => {
    if (!duplicateVideoAction) return;

    setIsDuplicating(videoId);
    try {
      await duplicateVideoAction({ body: { videoId } });
      toast.success(`Video "${videoName}" duplicated successfully`);
      router.refresh();
    } catch {
      toast.error("Failed to duplicate video");
    } finally {
      setIsDuplicating(null);
    }
  };

  const handleDeleteClick = (id: string, name: string) => {
    setDeleteItem({ id, name });
    setShowDeleteDialog(true);
  };

  const handleEdit = (id: string) => {
    router.push(`/create/videos/v/${id}`);
  };

  const renderVideoCard = (video: (typeof videos)[number]) => (
    <Card
      key={video.video_id}
      data-testid="video-card"
      data-video-id={video.video_id}
      className="hover:shadow-md transition-shadow flex flex-col h-full"
    >
      <CardHeader className="pb-3">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div className="space-y-2 flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <CardTitle className="text-lg flex-1 min-w-0 truncate">
                {video.name || "Unnamed Video"}
              </CardTitle>
              <div className="flex gap-1 flex-wrap flex-shrink-0">
                {!video.active && <Badge variant="secondary">Inactive</Badge>}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            {video.can_edit ? (
              <Button
                variant="outline"
                size="sm"
                data-testid="btn-edit-video"
                onClick={() => handleEdit(video.video_id)}
                className="h-9 px-3"
              >
                <Edit className="h-4 w-4 md:mr-0 mr-2" />
                <span className="md:hidden">Edit</span>
              </Button>
            ) : null}
            {video.can_duplicate && (
              <Button
                variant="outline"
                size="sm"
                data-testid="btn-duplicate-video"
                onClick={() => handleDuplicate(video.video_id, video.name)}
                disabled={isDuplicating === video.video_id}
                className="h-9 px-3"
              >
                {isDuplicating === video.video_id ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent md:mr-0 mr-2" />
                ) : (
                  <Copy className="h-4 w-4 md:mr-0 mr-2" />
                )}
                <span className="md:hidden">
                  {isDuplicating === video.video_id
                    ? "Duplicating..."
                    : "Duplicate"}
                </span>
              </Button>
            )}

            {video.can_delete && (
              <Button
                variant="outline"
                size="sm"
                data-testid="btn-delete-video"
                onClick={() =>
                  handleDeleteClick(
                    video.video_id,
                    video.name || "Unnamed Video"
                  )
                }
                className="h-9 px-3"
              >
                <Trash2 className="h-4 w-4 md:mr-0 mr-2" />
                <span className="md:hidden">Delete</span>
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0 flex-grow flex flex-col justify-end">
        <p className="text-sm text-muted-foreground line-clamp-2">
          {video.description || "No description provided."}
        </p>
        <div className="flex items-center gap-1.5 mt-3 text-xs text-muted-foreground flex-wrap">
          <span className="flex items-center gap-1">
            {formatDuration(video.length_seconds)}
          </span>
        </div>
      </CardContent>
    </Card>
  );

  // Get column references for toolbar
  const nameColumn = table.getColumn("name");
  const departmentsColumn = table.getColumn("departments");
  const isFiltered = table.getState().columnFilters.length > 0;

  return (
    <TooltipProvider>
      <div className="space-y-8" data-page="videos-index">
        <div className="space-y-4">
          {/* Toolbar */}
          <div
            className="flex flex-col md:flex-row md:items-center md:justify-between gap-2"
            data-testid="videos-toolbar"
          >
            <div className="flex flex-col md:flex-row md:flex-1 md:items-center md:space-x-2 gap-2 md:gap-0">
              <div className="w-full md:w-auto">
                <Input
                  data-testid="videos-search"
                  placeholder="Search videos..."
                  value={(nameColumn?.getFilterValue() as string) ?? ""}
                  onChange={(event) =>
                    nameColumn?.setFilterValue(event.target.value)
                  }
                  className="h-8 w-full md:w-[150px] lg:w-[250px]"
                  aria-label="Search videos by name"
                  aria-controls="videos-grid"
                />
              </div>

              <div className="flex items-center space-x-2 flex-wrap">
                {/* Department Filter */}
                {departmentsColumn &&
                  departmentOptions.length > 0 &&
                  departmentOptions.length > 1 && (
                    <DataTableFacetedFilter
                      column={departmentsColumn}
                      title="Department"
                      options={departmentOptions}
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
          </div>

          {/* Videos Grid */}
          <div
            className="space-y-4"
            role="grid"
            aria-label="videos grid"
            data-testid="videos-grid"
          >
            {tableRows.length ? (
              tableRows.map((row) => renderVideoCard(row.original))
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No videos match the current filters.
              </div>
            )}
          </div>

          {/* Pagination */}
          <DataTablePagination table={table} />
        </div>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent
            aria-labelledby="delete-video-title"
            data-testid="dialog-delete-video"
          >
            <AlertDialogHeader>
              <AlertDialogTitle id="delete-video-title">
                Delete Video
              </AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete the video "{deleteItem?.name}
                "? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel
                disabled={isDeleting}
                data-testid="btn-cancel-delete"
              >
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                disabled={isDeleting}
                className="bg-red-600 hover:bg-red-700 text-white"
                data-testid="btn-confirm-delete"
              >
                {isDeleting ? "Deleting..." : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  );
}
