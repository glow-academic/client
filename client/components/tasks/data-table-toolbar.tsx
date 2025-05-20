"use client"

import { Table } from "@tanstack/react-table"
import { X, Download, AlertCircle } from "lucide-react"
import { DateRange } from "react-day-picker"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DataTableViewOptions } from "@/components/tasks/data-table-view-options"
import { DatePickerWithRange } from "@/components/ui/date-picker-range"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { toast } from "sonner" // Confirmed this is the correct import
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

import { DataTableFacetedFilter } from "@/components/tasks/data-table-faceted-filter"
import { statuses } from "./columns" // Import statuses from columns.tsx

// Column name mapping for CSV export (same as in data-table-view-options.tsx)
const columnMap = {
  "createdAt": "Date",
  "classId": "Class",
  "userId": "Name",
  "profile": "Profile", 
  "title": "Title",
  "status": "Status",
  "score": "Score"
}

// Helper function to determine chat status
const getStatusLabel = (chat: any, statusValue?: string): string => {
  if (statusValue) {
    // If status is explicitly provided
    return statusValue;
  }
  
  // Otherwise determine from chat properties
  if (chat.hasRubric || (chat.score && chat.score > 0)) {
    return "Completed";
  } else if (chat.completed) {
    return "Grading";
  } else {
    return "In Progress";
  }
}

// Define score options
const scoreOptions = [
  { value: "adaptability", label: "Adaptability" },
  { value: "listening", label: "Listening" },
  { value: "objectives", label: "Objectives" },
  { value: "timeManagement", label: "Time Management" },
]

// Maximum rows to export without confirmation
const MAX_ROWS_WITHOUT_CONFIRM = 100;

interface DataTableToolbarProps<TData> {
  table: Table<TData>
  userOptions: { value: string; label: string }[]
  classOptions: { value: string; label: string }[]
  isAdmin?: boolean
  dateRange?: DateRange | undefined
  setDateRange?: (range: DateRange | undefined) => void
}

export function DataTableToolbar<TData>({
  table,
  userOptions,
  classOptions,
  isAdmin = false,
  dateRange,
  setDateRange,
}: DataTableToolbarProps<TData>) {
  // Check if any filters other than the date range are active
  const isFiltered = table.getState().columnFilters.filter(
    filter => filter.id !== "createdAt"
  ).length > 0;
  
  const selectedRows = Object.keys(table.getState().rowSelection).length
  const [exportPopoverOpen, setExportPopoverOpen] = useState(false)
  const [showExportConfirm, setShowExportConfirm] = useState(false)
  const [rowsToExport, setRowsToExport] = useState<number>(0)

  // Function to prepare for export
  const prepareExport = () => {
    const rowCount = selectedRows > 0 
      ? table.getFilteredSelectedRowModel().rows.length
      : table.getFilteredRowModel().rows.length;
    
    setRowsToExport(rowCount);
    
    if (rowCount > MAX_ROWS_WITHOUT_CONFIRM) {
      setShowExportConfirm(true);
      setExportPopoverOpen(false);
    } else {
      handleExportToCSV();
    }
  };

  // Function to export selected rows to CSV
  const handleExportToCSV = () => {
    try {
      // Get all checked rows
      const selectedData = selectedRows > 0 
        ? table.getFilteredSelectedRowModel().rows
        : table.getFilteredRowModel().rows;
      
      // Get visible columns (except 'actions' column)
      const visibleColumns = table.getVisibleLeafColumns()
        .filter(col => col.id !== 'actions' && col.id !== 'select');
      
      // Create CSV header based on visible column headers with proper mapping
      const headerRow = visibleColumns.map(column => {
        // Use the column mapping if available, otherwise use the column ID
        return columnMap[column.id as keyof typeof columnMap] || column.id;
      }).join(',');
      
      // Create CSV rows from selected data
      const csvRows = selectedData.map(row => {
        return visibleColumns.map(column => {
          // Get cell value, handle different data types
          const cellValue = row.getValue(column.id);
          
          // Special handling for specific column types
          if (column.id === 'createdAt' && cellValue) {
            const date = new Date(cellValue as string);
            return `"${date.toLocaleString('en-US', {
              year: 'numeric', 
              month: 'short', 
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
              hour12: false
            })}"`;
          }
          
          // Special handling for status column
          if (column.id === 'status') {
            const original = row.original as any;
            // Use our helper function to get the status label
            return `"${getStatusLabel(original)}"`;
          }
          
          // Special handling for class and user IDs - map to human-readable names
          if (column.id === 'classId' && cellValue) {
            const classOption = classOptions.find(cls => cls.value === cellValue);
            return classOption ? `"${classOption.label}"` : `"${cellValue}"`;
          }
          
          if (column.id === 'userId' && cellValue) {
            const userOption = userOptions.find(user => user.value === cellValue);
            return userOption ? `"${userOption.label}"` : `"${cellValue}"`;
          }
          
          // Handle string values that might contain commas
          if (typeof cellValue === 'string') {
            return `"${cellValue.replace(/"/g, '""')}"`;
          }
          
          // Handle other types
          return cellValue !== null && cellValue !== undefined ? String(cellValue) : '';
        }).join(',');
      });
      
      // Combine header and rows
      const csvData = [headerRow, ...csvRows].join('\n');
      
      // Create a Blob for the CSV
      const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
      
      // Create a temporary link element to download the file
      const today = new Date();
      const filename = `chats_export_${today.toISOString().slice(0, 10)}.csv`;
      
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      
      document.body.appendChild(link);
      link.click();
      
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      toast?.success(`Exported ${selectedData.length} rows to CSV`);
      setExportPopoverOpen(false);
      setShowExportConfirm(false);
    } catch (error) {
      console.error('Error exporting to CSV:', error);
      toast?.error('Failed to export data');
      setShowExportConfirm(false);
    }
  };

  return (
    <>
      <div className="flex items-center justify-between">
        <div className="flex flex-1 items-center space-x-2">
          <Input
            placeholder="Filter chats..."
            value={(table.getColumn("title")?.getFilterValue() as string) ?? ""}
            onChange={(event) =>
              table.getColumn("title")?.setFilterValue(event.target.value)
            }
            className="h-8 w-[150px] lg:w-[250px]"
          />
          {table.getColumn("status") && (
            <DataTableFacetedFilter
              column={table.getColumn("status")}
              title="Status"
              options={statuses}
            />
          )}
          {isAdmin && table.getColumn("userId") && (
            <DataTableFacetedFilter
              column={table.getColumn("userId")}
              title="Name"
              options={userOptions}
            />
          )}
          {table.getColumn("classId") && (
            <DataTableFacetedFilter
              column={table.getColumn("classId")}
              title="Class"
              options={classOptions}
            />
          )}
          {table.getColumn("score") && ( // This is for the score column which uses id as accessor
            <DataTableFacetedFilter
              column={table.getColumn("score")}
              title="Score"
              options={scoreOptions}
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
        <div className="flex items-center space-x-2">
          {/* Date range picker */}
          {setDateRange && (
            <DatePickerWithRange
              dateRange={dateRange}
              setDateRange={setDateRange}
              className="w-auto"
            />
          )}
          
          {/* Export to CSV button/popover */}
          <Popover open={exportPopoverOpen} onOpenChange={setExportPopoverOpen}>
            <PopoverTrigger asChild>
              <Button 
                variant="outline" 
                size="sm"
                className="h-8"
              >
                <Download className="mr-2 h-4 w-4" />
                Export {selectedRows > 0 ? `(${selectedRows})` : ""}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-60 p-4" align="end">
              <div className="space-y-4">
                <h4 className="font-medium text-sm">Export Options</h4>
                <div className="space-y-2">
                  <div className="text-xs text-muted-foreground mb-2">
                    {selectedRows > 0 
                      ? `Exporting ${selectedRows} selected rows` 
                      : "Exporting all filtered rows"}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Exports currently visible columns with proper formatting.
                  </p>
                  <div className="pt-2 flex justify-end">
                    <Button 
                      size="sm" 
                      className="w-full" 
                      onClick={prepareExport}
                    >
                      Export to CSV
                    </Button>
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>
          
          <DataTableViewOptions table={table} isAdmin={isAdmin} />
        </div>
      </div>

      {/* Confirmation dialog for large exports */}
      <AlertDialog open={showExportConfirm} onOpenChange={setShowExportConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              Large Export
            </AlertDialogTitle>
            <AlertDialogDescription>
              You are about to export {rowsToExport} rows. This may take some time and could cause your browser to become unresponsive.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleExportToCSV}>
              Continue Export
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
