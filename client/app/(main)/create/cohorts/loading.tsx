/**
 * app/(main)/create/cohorts/loading.tsx
 * Loading skeleton for cohorts page
 * @AshokSaravanan222 & @siladiea
 * 01/20/2025
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-32" />
      </div>

      {/* Toolbar skeleton */}
      <div className="flex items-center justify-between">
        <div className="flex flex-1 items-center space-x-2 flex-wrap">
          <div className="mb-2">
            {/* Search input */}
            <Skeleton className="h-8 w-[150px] lg:w-[250px]" />
          </div>

          <div className="flex items-center space-x-2 flex-wrap mb-2">
            {/* Filter buttons */}
            <Skeleton className="h-8 w-[100px]" />
            <Skeleton className="h-8 w-[120px]" />
          </div>
        </div>
      </div>

      {/* Cohorts grid skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...Array(6)].map((_, i) => (
          <Card key={i} className="relative flex flex-col h-full">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle>
                    <Skeleton className="h-6 w-32" />
                  </CardTitle>
                  <div className="mt-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-5 w-24 rounded-full" />
                    </div>
                    <Skeleton className="h-5 w-20 rounded-full" />
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Skeleton className="h-9 w-9" />
                  <Skeleton className="h-9 w-9" />
                  <Skeleton className="h-9 w-9" />
                  <Skeleton className="h-9 w-9" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-3/4 mb-3" />
              <div className="flex items-center gap-2">
                <Skeleton className="h-3 w-3" />
                <Skeleton className="h-3 w-16" />
              </div>
            </CardContent>
          </Card>
        ))}
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
  );
}

