"use client";
import { Skeleton } from "@/components/ui/skeleton";

export function HistorySkeleton({ rows = 10 }: { rows?: number }) {
  return (
    <div className="space-y-4">
      {/* Toolbar skeleton */}
      <div className="flex items-center justify-between">
        <div className="flex flex-1 items-center space-x-2">
          <Skeleton className="h-8 w-[250px]" /> {/* search */}
          <Skeleton className="h-8 w-[120px]" /> {/* Name filter */}
          <Skeleton className="h-8 w-[140px]" /> {/* Simulation filter */}
          <Skeleton className="h-8 w-[160px]" /> {/* Scenarios filter */}
          <Skeleton className="h-8 w-[70px]" /> {/* Reset */}
        </div>
        <div className="flex items-center space-x-2">
          <Skeleton className="h-8 w-[150px]" /> {/* Export / View */}
          <Skeleton className="h-8 w-[90px]" />
        </div>
      </div>

      {/* Table skeleton */}
      <div className="rounded-md border">
        {/* header */}
        <div className="grid grid-cols-6 gap-0 px-6 py-3 border-b">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-40 col-span-2" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-16 justify-self-end" />
        </div>
        {/* rows */}
        <div className="divide-y">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="grid grid-cols-6 gap-0 px-6 py-4">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-[90%] col-span-2" />
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-10" />
                <Skeleton className="h-4 w-10" />
              </div>
              <div className="flex items-center justify-end gap-2">
                <Skeleton className="h-8 w-20" />
                <Skeleton className="h-8 w-8" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Pagination skeleton */}
      <div className="flex items-center justify-end px-2">
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-[70px]" />
          </div>
          <Skeleton className="h-4 w-24" />
          <div className="flex items-center space-x-2">
            <Skeleton className="h-8 w-8" />
            <Skeleton className="h-8 w-8" />
            <Skeleton className="h-8 w-8" />
            <Skeleton className="h-8 w-8" />
          </div>
        </div>
      </div>
    </div>
  );
}
