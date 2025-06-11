"use client";

import { Button } from "@/components/ui/button";

import Link from "next/link";

interface DataTableRowActionsProps {
  id: string;
  completed: boolean;
  showChats?: boolean;
  isOwnUser?: boolean;
}

export function DataTableRowActions({
  id,
  completed,
  showChats = false,
  isOwnUser = false,
}: DataTableRowActionsProps) {
  // For non-admin view, render a simple button instead of dropdown
  if (showChats) {
    if (!completed && isOwnUser) {
      return (
        <Link href={`/home/a/${id}`}>
          <Button variant="outline" size="sm" className="h-8">
            Continue
          </Button>
        </Link>
      );
    } else {
      return (
        <Link href={`/c/${id}`}>
          <Button variant="outline" size="sm" className="h-8">
            View
          </Button>
        </Link>
      );
    }
  } else {
    return (
      <Link href={`/home/a/${id}`}>
        <Button variant="outline" size="sm" className="h-8">
          View
        </Button>
      </Link>
    );
  }
}
