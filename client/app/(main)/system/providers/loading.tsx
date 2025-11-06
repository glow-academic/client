/**
 * app/(main)/system/providers/loading.tsx
 * Loading skeleton for providers page
 * @AshokSaravanan222 & @siladiea
 * 01/20/2025
 */
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-6">
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
              <Skeleton className="h-8 w-[100px]" />
              <Skeleton className="h-8 w-[80px]" />
              <Skeleton className="h-8 w-[100px]" />
            </div>
          </div>
        </div>

        {/* Provider groups skeleton */}
        <div className="space-y-6">
          {[...Array(2)].map((_, providerIdx) => (
            <div key={providerIdx} className="space-y-4">
              {/* Provider header */}
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-6 w-32 rounded-full" />
                  <Skeleton className="h-4 w-48" />
                </div>
                <div className="flex items-center gap-1">
                  <Skeleton className="h-9 w-9" />
                  <Skeleton className="h-9 w-9" />
                  <Skeleton className="h-9 w-9" />
                </div>
              </div>

              {/* Models grid */}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 items-stretch">
                {[...Array(4)].map((_, modelIdx) => (
                  <Card
                    key={modelIdx}
                    className="hover:shadow-md transition-shadow flex flex-col h-full min-h-[220px]"
                  >
                    <CardHeader className="flex-0">
                      <div className="flex justify-between items-start">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Skeleton className="h-4 w-4" />
                            <Skeleton className="h-5 w-32" />
                          </div>
                          <Skeleton className="h-3 w-48" />
                        </div>
                        <div className="flex gap-1">
                          <Skeleton className="h-5 w-16 rounded-full" />
                          <Skeleton className="h-5 w-20 rounded-full" />
                        </div>
                      </div>
                    </CardHeader>
                    <CardFooter className="mt-auto flex justify-end gap-2">
                      <Skeleton className="h-9 w-9" />
                      <Skeleton className="h-9 w-9" />
                      <Skeleton className="h-9 w-9" />
                    </CardFooter>
                  </Card>
                ))}

                {/* Create New Model Card skeleton */}
                <Card className="border-dashed border-2 flex flex-col h-full min-h-[220px]">
                  <CardContent className="flex flex-col items-center justify-center py-12 grow">
                    <Skeleton className="h-8 w-8 rounded mb-3" />
                    <Skeleton className="h-4 w-32 mb-1" />
                    <Skeleton className="h-3 w-40" />
                  </CardContent>
                </Card>
              </div>
            </div>
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

