"use client";

/**
 * Pricing.tsx
 * Loading skeleton for the pricing analytics page.
 *
 * NOTE: The interactive ``Pricing`` component that previously lived here
 * was written against a stale ``/system/pricing`` response shape and is
 * no longer rendered — the live page uses ``PricingSummary`` +
 * ``PricingRunsClient`` (see ``app/(main)/analytics/pricing/page.tsx``).
 * Only ``PricingSkeleton`` is still consumed (by ``loading.tsx``), so the
 * dead component was removed to keep the file type-safe.
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function PricingSkeleton() {
  return (
    <div className="flex flex-col gap-4" data-testid="pricing-container">
      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card>
          <CardHeader className="py-3">
            <CardTitle>
              <Skeleton className="h-4 w-24" />
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <Skeleton className="h-8 w-32" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="py-3">
            <CardTitle>
              <Skeleton className="h-4 w-28" />
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <Skeleton className="h-8 w-16" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="py-3">
            <CardTitle>
              <Skeleton className="h-4 w-32" />
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <Skeleton className="h-8 w-24" />
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      <Card className="w-full">
        <CardHeader className="pb-2">
          <CardTitle>
            <Skeleton className="h-5 w-32" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full rounded-lg" />
        </CardContent>
      </Card>

      {/* Runs table */}
      <div className="mt-6 space-y-3">
        {/* Filters + Search */}
        <div className="flex items-center justify-between">
          <div className="flex flex-1 items-center space-x-2">
            {/* Search bar */}
            <Skeleton className="h-8 w-[200px]" />

            {/* Filter buttons */}
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-8 w-24" />
          </div>

          <div className="flex items-center space-x-2">
            {/* Column visibility */}
            <Skeleton className="h-8 w-8" />
          </div>
        </div>

        {/* Table skeleton */}
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <Skeleton className="h-4 w-24" />
                </TableHead>
                <TableHead>
                  <Skeleton className="h-4 w-20" />
                </TableHead>
                <TableHead>
                  <Skeleton className="h-4 w-20" />
                </TableHead>
                <TableHead>
                  <Skeleton className="h-4 w-32" />
                </TableHead>
                <TableHead>
                  <Skeleton className="h-4 w-28" />
                </TableHead>
                <TableHead>
                  <Skeleton className="h-4 w-28" />
                </TableHead>
                <TableHead>
                  <Skeleton className="h-4 w-20" />
                </TableHead>
                <TableHead>
                  <Skeleton className="h-4 w-16" />
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...Array(10)].map((_, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <Skeleton className="h-4 w-32" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-24" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-24" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-32" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-24" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-24" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-20" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-7 w-7" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Pagination skeleton */}
        <div className="flex items-center justify-between px-2">
          <Skeleton className="h-8 w-[100px]" />
          <div className="flex items-center space-x-2">
            <Skeleton className="h-8 w-[70px]" />
            <Skeleton className="h-8 w-[70px]" />
          </div>
        </div>
      </div>
    </div>
  );
}
