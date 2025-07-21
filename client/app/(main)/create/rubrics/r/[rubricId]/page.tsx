/**
 * app/create/rubrics/r/[rubricId]/page.tsx
 * Rubric editing page
 * @AshokSaravanan222 & @siladiea
 * 06/09/2025
 */

import RubricEdit from "@/components/create/rubrics/RubricEdit";
import { use } from "react";

import { getRubric } from "@/utils/queries/rubrics/get-rubric";
import type { Metadata, ResolvingMetadata } from "next";

export async function generateMetadata(
  { params }: { params: Promise<{ rubricId: string }> },
  _parent: ResolvingMetadata
): Promise<Metadata> {
  const { rubricId } = await params;
  const rubric = await getRubric(rubricId);

  return {
    title: `${rubric?.name || "Rubric"}`,
    description: `${rubric?.name + " " + rubric?.description || "Rubric"} in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
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
