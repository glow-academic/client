/**
 * app/(main)/create/simulations/s/[simulationId]/loading.tsx
 * Loading skeleton for simulation edit page
 * @AshokSaravanan222 & @siladiea
 * 01/20/2025
 */
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-6">
      <form className="space-y-6">
        {/* Title */}
        <div className="space-y-2">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-10 w-full" />
        </div>

        {/* Description */}
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-20 w-full" />
        </div>

        {/* Department Selection */}
        <div className="space-y-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-10 w-full" />
        </div>

        {/* Active and Practice Switches */}
        <div className="space-y-2 pt-2">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-6 w-11" />
            </div>
            <Skeleton className="h-3 w-64 ml-5" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-6 w-11" />
            </div>
            <Skeleton className="h-3 w-56 ml-5" />
          </div>
        </div>

        {/* Time Limit and Rubric Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-10 w-full" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-10 w-full" />
          </div>
        </div>

        {/* Scenarios */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-10 w-full" />
          </div>
          {/* Scenario cards grid skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mt-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-32 w-full rounded-lg" />
              </div>
            ))}
          </div>
        </div>
      </form>
    </div>
  );
}

