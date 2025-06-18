/**
 * app/(main)/management/cohorts/c/[cohortId]/page.tsx
 * Cohort edit page for the cohort.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import CohortEdit from "@/components/management/cohorts/CohortEdit";
import { use } from "react";

export default function CohortEditPage({
  params,
}: {
  params: Promise<{ cohortId: string }>;
}) {
  const { cohortId } = use(params);
  return (
    <div className="space-y-6">
      <CohortEdit cohortId={cohortId} />
    </div>
  );
}
