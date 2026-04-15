/**
 * app/(main)/attempt/[attemptId]/[chatId]/loading.tsx
 * Loading skeleton for chat page — mirrors FullPageLayout structure.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */
import { cookies } from "next/headers";
import { FullPageSkeleton } from "@/components/common/layout/FullPageSkeleton";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default async function Loading() {
  const cookieStore = await cookies();
  const sidebarOpen = cookieStore.get("glow_sidebar")?.value !== "false";

  return (
    <FullPageSkeleton sidebarOpen={sidebarOpen} panelOpen={false}>
      <div className="px-4">
        <Card className="p-6 space-y-4">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <div className="space-y-3 pt-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded" />
            ))}
          </div>
        </Card>
      </div>
    </FullPageSkeleton>
  );
}
