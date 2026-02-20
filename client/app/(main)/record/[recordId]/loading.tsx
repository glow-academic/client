/**
 * app/(main)/record/[recordId]/loading.tsx
 * Loading skeleton for record (profile report) page.
 * @AshokSaravanan222 & @siladiea
 * 01/20/2025
 */
import { HistorySkeleton } from "@/components/artifacts/attempt/history/SimulationHistory";
import FooterSkeleton from "@/components/artifacts/dashboard/skeletons/FooterSkeleton";
import HeaderSkeleton from "@/components/artifacts/dashboard/skeletons/HeaderSkeleton";
import PrimarySkeleton from "@/components/artifacts/dashboard/skeletons/PrimarySkeleton";
import SecondarySkeleton from "@/components/artifacts/dashboard/skeletons/SecondarySkeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
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
  );
}
