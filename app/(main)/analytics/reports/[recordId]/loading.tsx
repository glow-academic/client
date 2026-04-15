/**
 * app/(main)/analytics/reports/[recordId]/loading.tsx
 * Loading skeleton for record (profile report) page — wraps in FullPageSkeleton.
 * @AshokSaravanan222 & @siladiea
 * 01/20/2025
 */
import { cookies } from "next/headers";
import { FullPageSkeleton } from "@/components/common/layout/FullPageSkeleton";
import { HistorySkeleton } from "@/components/common/SimulationHistory";
import FooterSkeleton from "@/components/artifacts/dashboard/skeletons/FooterSkeleton";
import HeaderSkeleton from "@/components/artifacts/dashboard/skeletons/HeaderSkeleton";
import PrimarySkeleton from "@/components/artifacts/dashboard/skeletons/PrimarySkeleton";
import SecondarySkeleton from "@/components/artifacts/dashboard/skeletons/SecondarySkeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";

export default async function Loading() {
  const cookieStore = await cookies();
  const sidebarOpen = cookieStore.get("glow_sidebar")?.value !== "false";
  const panelOpen = cookieStore.get("glow_panel")?.value === "true";

  return (
    <FullPageSkeleton sidebarOpen={sidebarOpen} panelOpen={panelOpen}>
      <div className="space-y-6">
        {/* Profile Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10 outline outline-muted-foreground">
                <AvatarFallback>
                  <Skeleton className="h-10 w-10 rounded-full" />
                </AvatarFallback>
              </Avatar>
              <div>
                <Skeleton className="h-7 w-48 mb-2" />
                <Skeleton className="h-4 w-64" />
              </div>
              <Skeleton className="h-6 w-24 rounded-full" />
            </div>
          </div>
        </div>

        <HeaderSkeleton />

        <div className="grid gap-6 grid-cols-1 lg:grid-cols-[3fr_2fr] pb-2 items-stretch">
          <PrimarySkeleton />
          <SecondarySkeleton />
        </div>

        <FooterSkeleton />

        <section className="space-y-4">
          <HistorySkeleton rows={8} />
        </section>
      </div>
    </FullPageSkeleton>
  );
}
