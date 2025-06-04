"use client";


import { Button } from "@/components/ui/button";

import Link from "next/link";

interface DataTableRowActionsProps {
  id: string;
  completed: boolean;
  isAdmin?: boolean;
  viewMode?: "chats" | "attempts";
}

export function DataTableRowActions({
  id,
  completed,
  isAdmin = false,
  viewMode = "chats",
}: DataTableRowActionsProps) {
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
