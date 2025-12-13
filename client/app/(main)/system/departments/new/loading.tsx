/**
 * app/(main)/system/departments/new/loading.tsx
 * Loading skeleton for department create page
 * @AshokSaravanan222 & @siladiea
 * 01/20/2025
 */
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-6">
      <form className="space-y-6">
        {/* Title Field */}
        <div className="space-y-2">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-10 w-full" />
        </div>

        {/* Description Field */}
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-20 w-full" />
        </div>

        {/* Active Switch */}
        <div className="space-y-2 pt-2">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-6 w-11" />
            </div>
            <Skeleton className="h-3 w-64 ml-5" />
          </div>
        </div>

        {/* Submit Buttons */}
        <div className="flex justify-end gap-4">
          <Skeleton className="h-10 w-20" />
          <Skeleton className="h-10 w-36" />
        </div>
      </form>
    </div>
  );
}

