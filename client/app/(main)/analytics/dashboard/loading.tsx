/**
 * app/(main)/analytics/dashboard/loading.tsx
 * Loading skeleton for dashboard page - composed from section skeletons.
 * @AshokSaravanan222 & @siladiea
 * 01/20/2025
 */
import { HistorySkeleton } from "@/components/artifacts/attempt/history/SimulationHistory";
import FooterSkeleton from "@/components/artifacts/dashboard/skeletons/FooterSkeleton";
import HeaderSkeleton from "@/components/artifacts/dashboard/skeletons/HeaderSkeleton";
import PrimarySkeleton from "@/components/artifacts/dashboard/skeletons/PrimarySkeleton";
import SecondarySkeleton from "@/components/artifacts/dashboard/skeletons/SecondarySkeleton";

export default function Loading() {
  return (
    <div className="space-y-6">
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
