/**
 * app/(main)/home/a/[attemptId]/loading.tsx
 * Loading skeleton for attempt chat page
 * @AshokSaravanan222 & @siladiea
 * 01/20/2025
 */
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="h-[calc(100vh-4rem)]">
      <div className="flex h-full gap-4">
        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col">
          <Card className="h-full flex flex-col py-4">
            <div className="flex flex-col h-full">
              {/* Header Section */}
              <div className="p-4 pt-0 flex flex-col gap-2 border-b">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <Skeleton className="h-6 w-64" />
                  </div>
                  <div className="flex items-start justify-end gap-2">
                    <div className="flex items-center gap-4">
                      <Skeleton className="h-6 w-20 rounded-full" />
                    </div>
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-8 w-8 rounded" />
                      <Skeleton className="h-8 w-8 rounded" />
                      <Skeleton className="h-8 w-8 rounded" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Messages Area */}
              <div className="flex-1 p-4 space-y-4 overflow-y-auto">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="space-y-2">
                    <div className="flex items-start gap-3">
                      <Skeleton className="h-8 w-8 rounded-full" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-20 w-full rounded-lg" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Input Area */}
              <div className="p-4 border-t">
                <div className="space-y-2">
                  <Skeleton className="h-24 w-full rounded-lg" />
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-9 w-24" />
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Optional Document Viewer Panel (hidden on mobile) */}
        <div className="hidden md:block w-[30%]">
          <Card className="h-full p-4">
            <div className="space-y-4">
              <Skeleton className="h-6 w-32" />
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full rounded" />
                ))}
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
