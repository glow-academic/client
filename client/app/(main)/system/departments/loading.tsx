/**
 * app/(main)/system/departments/loading.tsx
 * Loading skeleton for departments page
 * @AshokSaravanan222 & @siladiea
 * 01/20/2025
 */
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-8">
      <div className="space-y-4">
        {/* Toolbar skeleton */}
        <div className="flex items-center justify-between">
          <div className="flex flex-1 items-center space-x-2 flex-wrap">
            <div className="mb-2">
              {/* Search input */}
              <Skeleton className="h-8 w-[150px] lg:w-[250px]" />
            </div>

            <div className="flex items-center space-x-2 flex-wrap mb-2">
              {/* Filter buttons */}
              <Skeleton className="h-8 w-[120px]" />
              <Skeleton className="h-8 w-[120px]" />
            </div>
          </div>
        </div>

        {/* Cards Grid skeleton */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-5 w-40" />
                    <div className="mt-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <Skeleton className="h-5 w-20 rounded-full" />
                        <Skeleton className="h-5 w-20 rounded-full" />
                      </div>
                    </div>
                    <Skeleton className="h-4 w-full mt-2" />
                  </div>
                  <div className="flex gap-2 items-center">
                    <Skeleton className="h-9 w-9" />
                    <Skeleton className="h-9 w-9" />
                    <Skeleton className="h-9 w-9" />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-sm">
                  <Skeleton className="h-4 w-24" />
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
    </div>
  );
}

