/**
 * app/(main)/create/cohorts/c/[cohortId]/page.tsx
 * Edit cohort page in create section
 * @AshokSaravanan222 & @siladiea
 * 06/18/2025
 */
import Cohort from "@/components/common/cohort/Cohort";

interface EditCohortPageProps {
  params: Promise<{
    cohortId: string;
  }>;
}

export default async function EditCohortPage({ params }: EditCohortPageProps) {
  const { cohortId } = await params;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Edit Cohort</h1>
        <p className="text-muted-foreground">
          Update cohort details and member assignments
        </p>
      </div>
      <Cohort cohortId={cohortId} />
    </div>
  );
}
