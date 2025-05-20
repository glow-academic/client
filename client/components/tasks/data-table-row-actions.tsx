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
  if (!isAdmin) {
    if (!hasRubric) {
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
    } else {
      return (
        <Link href={`/chat/${chat.id}`}>
          <Button
            variant="outline"
            size="sm"
            className="h-8"
          >
            View
          </Button>
        </Link>
      )
    }
  } else {
    return (
      <Link href={`/chat/${chat.id}`}>
        <Button variant="outline" size="sm" className="h-8">
          View
        </Button>
      </Link>
    )
  }
}