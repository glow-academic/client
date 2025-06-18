/**
 * app/(main)/create/cohorts/page.tsx
 * Cohorts list page in create section
 * @AshokSaravanan222 & @siladiea
 * 06/18/2025
 */
import Cohorts from "@/components/management/cohorts/Cohorts";

export default function CohortsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Cohorts</h1>
        <p className="text-muted-foreground">
          Manage and create student cohorts
        </p>
      </div>
      <Cohorts />
    </div>
  );
}
