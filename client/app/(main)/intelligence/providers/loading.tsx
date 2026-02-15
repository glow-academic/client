/**
 * app/(main)/intelligence/providers/loading.tsx
 * Loading skeleton for providers page
 * @AshokSaravanan222 & @siladiea
 * 02/15/2026
 */
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-6">
      {/* Toolbar skeleton */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
        <div className="flex flex-col md:flex-row md:flex-1 md:items-center md:space-x-2 gap-2 md:gap-0">
          <Skeleton className="h-8 w-full md:w-[150px] lg:w-[250px]" />
          {/* Filter buttons: Provider, Status */}
          <Skeleton className="h-8 w-[100px]" />
          <Skeleton className="h-8 w-[90px]" />
        </div>
      </div>

      {/* Providers Grid skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...Array(6)].map((_, i) => (
          <Card key={i} className="relative flex flex-col h-full">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <Skeleton className="h-6 w-40 mb-2" />
                  <div className="mt-1">
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-5 w-20 rounded-full" />
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Skeleton className="h-9 w-9" />
                  <Skeleton className="h-9 w-9" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0 flex-1 flex flex-col">
              <Skeleton className="h-4 w-full mb-1" />
              <Skeleton className="h-4 w-3/4" />
            </CardContent>
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
  );
}
