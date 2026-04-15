/**
 * app/(main)/analytics/dashboard/loading.tsx
 * Loading skeleton for dashboard page - composed from section skeletons.
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

function DashboardContentSkeleton() {
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

export default async function Loading() {
  const cookieStore = await cookies();
  const sidebarOpen = cookieStore.get("glow_sidebar")?.value !== "false";
  const panelOpen = cookieStore.get("glow_panel")?.value === "true";

  return (
    <FullPageSkeleton sidebarOpen={sidebarOpen} panelOpen={panelOpen}>
      <DashboardContentSkeleton />
    </FullPageSkeleton>
  );
}
