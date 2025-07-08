/**
 * app/management/rubrics/r/[rubricId]/page.tsx
 * Rubric editing page
 * @AshokSaravanan222 & @siladiea
 * 06/09/2025
 */

import { use } from "react";
import RubricEdit from "@/components/management/rubrics/RubricEdit";

import type { Metadata, ResolvingMetadata } from "next";
import { getRubric } from "@/utils/queries/rubrics/get-rubric";


export async function generateMetadata(
  { params }: { params: Promise<{ rubricId: string }> },
  _parent: ResolvingMetadata
): Promise<Metadata> {
  const { rubricId } = await params;
  const rubric = await getRubric(rubricId);

  return {
    title: `${rubric?.name || "Rubric"}`,
    description: `${rubric?.name + " " + rubric?.description || "Rubric"} in GLOW (Graduate Learning Orientation Workshop) at Purdue University.`,
  };
}



export default function EditRubricPage({
  params,
}: {
  params: Promise<{ rubricId: string }>;
}) {
  const { rubricId } = use(params);

  return (
    <div className="space-y-6">
      <RubricEdit rubricId={rubricId} />
    </div>
  );
}
