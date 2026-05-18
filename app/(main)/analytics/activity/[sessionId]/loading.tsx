/**
 * app/(main)/analytics/activity/[sessionId]/loading.tsx
 * Loading skeleton for session detail page — wraps in FullPageSkeleton.
 * @AshokSaravanan222
 * 02/06/2026
 */
import { cookies } from "next/headers";
import { FullPageSkeleton } from "@/components/common/layout/FullPageSkeleton";
import { Skeleton } from "@/components/ui/skeleton";

export default async function Loading() {
  const cookieStore = await cookies();
  const sidebarOpen = cookieStore.get("glow_sidebar")?.value !== "false";
  const panelOpen = cookieStore.get("glow_panel")?.value === "true";

  return (
    <FullPageSkeleton sidebarOpen={sidebarOpen} panelOpen={panelOpen}>
      <div className="space-y-6 px-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full rounded-lg" />
        <Skeleton className="h-48 w-full rounded-lg" />
      </div>
    </FullPageSkeleton>
  );
}
