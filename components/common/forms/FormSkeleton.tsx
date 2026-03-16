import { Skeleton } from "@/components/ui/skeleton";

import { StepCardSkeleton } from "./StepCardSkeleton";

interface FormSkeletonProps {
  steps: number;
  wrapper?: string;
}

export function FormSkeleton({
  steps,
  wrapper = "w-full p-6 space-y-8",
}: FormSkeletonProps) {
  return (
    <div className={wrapper}>
      <div className="space-y-8">
        {Array.from({ length: steps }, (_, i) => (
          <StepCardSkeleton key={i} pending={i > 0} />
        ))}
      </div>
      <div className="flex justify-end gap-3">
        <Skeleton className="h-10 w-[120px]" />
        <Skeleton className="h-10 w-[120px]" />
      </div>
    </div>
  );
}
