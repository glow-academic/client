"use client";

import { Button } from "@/components/ui/button";

import Link from "next/link";

interface DataTableRowActionsProps {
  id: string;
}

export function DataTableRowActions({
  id,
}: DataTableRowActionsProps) {
  return (
    <Link href={`/home/a/${id}`}>
      <Button variant="outline" size="sm" className="h-8">
        View
      </Button>
    </Link>
  );
}
