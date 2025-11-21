/**
 * app/(main)/system/models/[modelId]/loading.tsx
 * Loading state for model edit page
 * @AshokSaravanan222 & @siladiea
 * 06/18/2025
 */

import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-6" data-page="model-edit-loading">
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-10 w-32" />
    </div>
  );
}

