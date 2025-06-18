/**
 * app/(main)/management/models/m/[modelId]/page.tsx
 * Model edit page for the model.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import ModelEdit from "@/components/management/models/ModelEdit";
import { use } from "react";

export default function CohortEditPage({
  params,
}: {
  params: Promise<{ modelId: string }>;
}) {
  const { modelId } = use(params);
  return (
    <div className="space-y-6">
      <ModelEdit modelId={modelId} />
    </div>
  );
}
