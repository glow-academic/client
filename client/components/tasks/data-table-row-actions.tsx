"use client"

import { Row } from "@tanstack/react-table"
import { MoreHorizontal } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { chats } from "@/drizzle/schema"
import { FileText, Eye } from "lucide-react"
import Link from "next/link"

interface DataTableRowActionsProps<TData> {
  row: Row<TData>
  isAdmin?: boolean
}

export function DataTableRowActions<TData>({
  row,
  isAdmin = false
}: DataTableRowActionsProps<TData>) {
  const chat = row.original as typeof chats.$inferSelect
  const hasRubric = chat.completed // Assuming completed status means it has a rubric

  // For non-admin view, render a simple button instead of dropdown
  if (!isAdmin && !hasRubric) {
    return (
      <Link href={`/chat/${chat.id}`}>
        <Button 
          variant="outline" 
          size="sm"
          className="h-8"
        >
          Continue
        </Button>
      </Link>
    )
  }

  // Admin view gets dropdown with more options
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="flex h-8 w-8 p-0 data-[state=open]:bg-muted"
        >
          <MoreHorizontal />
          <span className="sr-only">Open menu</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[160px]">
        <DropdownMenuItem>
          <Eye className="mr-2 h-4 w-4" />
          View
        </DropdownMenuItem>
        <DropdownMenuItem>
          <FileText className="mr-2 h-4 w-4" />
          Create Report
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
