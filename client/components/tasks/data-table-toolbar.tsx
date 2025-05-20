"use client"

import { Table } from "@tanstack/react-table"
import { X, FilePlus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DataTableViewOptions } from "@/components/tasks/data-table-view-options"

import { DataTableFacetedFilter } from "@/components/tasks/data-table-faceted-filter"
import { statuses } from "./columns" // Import statuses from columns.tsx

// Define score options
const scoreOptions = [
  { value: "adaptability", label: "Adaptability" },
  { value: "listening", label: "Listening" },
  { value: "objectives", label: "Objectives" },
  { value: "timeManagement", label: "Time Management" },
]

interface DataTableToolbarProps<TData> {
  table: Table<TData>
  userOptions: { value: string; label: string }[]
  classOptions: { value: string; label: string }[]
  isAdmin?: boolean
}

export function DataTableToolbar<TData>({
  table,
  userOptions,
  classOptions,
  isAdmin = false,
}: DataTableToolbarProps<TData>) {
  const isFiltered = table.getState().columnFilters.length > 0
  const selectedRows = Object.keys(table.getState().rowSelection).length

  const handleCreateReport = () => {
    const selectedRowIds = Object.keys(table.getState().rowSelection)
    const selectedData = table.getFilteredSelectedRowModel().rows.map(row => row.original)
    console.log('Creating report for:', selectedData)
    // Here you would implement your report creation logic
    alert(`Creating report for ${selectedRowIds.length} items`)
  }

  return (
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
        {table.getColumn("userId") && (
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
        {isAdmin && selectedRows > 0 && (
          <Button 
            variant="outline" 
            size="sm"
            className="h-8" 
            onClick={handleCreateReport}
          >
            <FilePlus className="mr-2 h-4 w-4" />Export {selectedRows} Chat{selectedRows === 1 ? "" : "s"}
          </Button>
        )}
        <DataTableViewOptions table={table} isAdmin={isAdmin} />
      </div>
    </div>
  )
}
