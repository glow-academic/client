/**
 * app/(main)/intelligence/models/loading.tsx
 * Loading state for models list page
 * @AshokSaravanan222 & @siladiea
 * 06/18/2025
 */
import { Card, CardFooter, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="space-y-4">
        {/* Toolbar skeleton */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
          <div className="flex flex-col md:flex-row md:flex-1 md:items-center md:space-x-2 gap-2 md:gap-0">
            <div className="w-full md:w-auto">
              {/* Search input */}
              <Skeleton className="h-8 w-full md:w-[150px] lg:w-[250px]" />
            </div>

            <div className="flex items-center space-x-2 flex-wrap">
              {/* Filter buttons: Provider, Type, Status */}
              <Skeleton className="h-8 w-[100px]" />
              <Skeleton className="h-8 w-[80px]" />
              <Skeleton className="h-8 w-[90px]" />
            </div>
          </div>
        </div>

        {/* Cards grid skeleton */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card
              key={i}
              className="hover:shadow-md transition-shadow flex flex-col h-full min-h-[220px]"
            >
              <CardHeader className="flex-0">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-2">
                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-4 w-4 flex-shrink-0" />
                      <Skeleton className="h-5 w-3/4" />
                    </div>
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-2/3" />
                  </div>
                  <div className="flex flex-wrap gap-1 flex-shrink-0">
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </div>
                </div>
                <div className="mt-2">
                  <Skeleton className="h-5 w-20 rounded-full" />
                </div>
              </CardHeader>
              <CardFooter className="mt-auto flex flex-wrap justify-end gap-2">
                <Skeleton className="h-9 w-20" />
                <Skeleton className="h-9 w-20" />
              </CardFooter>
            </Card>
          ))}
        </div>

        {/* Pagination skeleton */}
        {/* Mobile */}
        <div className="flex items-center px-2 md:hidden">
          <div className="flex items-center space-x-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-[70px]" />
          </div>
          <div className="flex-1 flex items-center justify-center">
            <Skeleton className="h-4 w-[80px]" />
          </div>
          <div className="flex items-center space-x-2">
            <Skeleton className="h-8 w-8" />
            <Skeleton className="h-8 w-8" />
          </div>
        </div>
        {/* Desktop */}
        <div className="hidden md:flex items-center px-2">
          <div className="flex-1" />
          <div className="flex items-center space-x-6 lg:space-x-8">
            <div className="flex items-center space-x-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-[70px]" />
            </div>
            <Skeleton className="h-4 w-[100px]" />
            <div className="flex items-center space-x-2">
              <Skeleton className="hidden h-8 w-8 lg:block" />
              <Skeleton className="h-8 w-8" />
              <Skeleton className="h-8 w-8" />
              <Skeleton className="hidden h-8 w-8 lg:block" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
