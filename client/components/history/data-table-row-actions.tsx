"use client";

import { Row } from "@tanstack/react-table";

import { Button } from "@/components/ui/button";

import { attempts, chats } from "@/drizzle/schema";
import Link from "next/link";

interface DataTableRowActionsProps<TData> {
  id: string;
  completed: boolean;
  isAdmin?: boolean;
  viewMode?: "chats" | "attempts";
}

export function DataTableRowActions<TData>({
  id,
  completed,
  isAdmin = false,
  viewMode = "chats",
}: DataTableRowActionsProps<TData>) {
  // For non-admin view, render a simple button instead of dropdown
  if (!isAdmin) {
    if (!completed) {
      return (
        <Link href={`/${viewMode === "chats" ? "c" : "a"}/${id}`}>
          <Button variant="outline" size="sm" className="h-8">
            Continue
          </Button>
        </Link>
      );
    } else {
      return (
        <Link href={`/${viewMode === "chats" ? "c" : "a"}/${id}`}>
          <Button variant="outline" size="sm" className="h-8">
            View
          </Button>
        </Link>
      );
    }
  } else {
    return (
      <Link href={`/${viewMode === "chats" ? "c" : "a"}/${id}`}>
        <Button variant="outline" size="sm" className="h-8">
          View
        </Button>
      </Link>
    );
  }
}
