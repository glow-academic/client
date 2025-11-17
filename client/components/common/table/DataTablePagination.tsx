import { Table } from "@tanstack/react-table";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface DataTablePaginationProps<TData> {
  table: Table<TData>;
  card?: boolean;
  staff?: boolean;
}

export function DataTablePagination<TData>({
  table,
  card = false,
  staff = false,
}: DataTablePaginationProps<TData>) {
  const pageSizeOptions = staff
    ? [100, 200, 300, 500, 1000]
    : card
      ? [12, 24, 36, 48, 60]
      : [10, 20, 30, 40, 50];
  const labelText = card ? "Items per page" : "Rows per page";
  // Adjust width of the selector for staff mode: bigger for 1000
  const selectWidth = staff ? "w-[85px]" : "w-[70px]";

  return (
    <div className="flex items-center px-2">
      {/* Left: Page size selector */}
      <div className="flex items-center space-x-2">
        <p className="text-sm font-medium">{labelText}</p>
        <Select
          value={`${table.getState().pagination.pageSize}`}
          onValueChange={(value) => {
            table.setPageSize(Number(value));
          }}
        >
          <SelectTrigger className={`h-8 ${selectWidth}`}>
            <SelectValue placeholder={table.getState().pagination.pageSize} />
          </SelectTrigger>
          <SelectContent side="top">
            {pageSizeOptions.map((pageSize) => (
              <SelectItem key={pageSize} value={`${pageSize}`}>
                {pageSize}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Middle: Page indicator with flex-grow to push controls apart */}
      <div className="flex-1 flex items-center justify-center">
        <div className="flex items-center justify-center text-sm font-medium">
          Page {table.getState().pagination.pageIndex + 1} of{" "}
          {table.getPageCount() || 1}
        </div>
      </div>

      {/* Right: Page navigation buttons */}
      <div className="flex items-center space-x-2">
        <Button
          type="button"
          variant="outline"
          className="hidden h-8 w-8 p-0 lg:flex"
          onClick={() => table.setPageIndex(0)}
          disabled={!table.getCanPreviousPage()}
        >
          <span className="sr-only">Go to first page</span>
          <ChevronsLeft />
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-8 w-8 p-0"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
        >
          <span className="sr-only">Go to previous page</span>
          <ChevronLeft />
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-8 w-8 p-0"
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
        >
          <span className="sr-only">Go to next page</span>
          <ChevronRight />
        </Button>
        <Button
          type="button"
          variant="outline"
          className="hidden h-8 w-8 p-0 lg:flex"
          onClick={() => table.setPageIndex(table.getPageCount() - 1)}
          disabled={!table.getCanNextPage()}
        >
          <span className="sr-only">Go to last page</span>
          <ChevronsRight />
        </Button>
      </div>
    </div>
  );
}
