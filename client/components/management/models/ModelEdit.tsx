/**
 * ModelEdit.tsx
 * Used to display the edit model page.
 * @AshokSaravanan222 & @siladiea
 * 06/18/2025
 */
"use client";
import Model from "@/components/common/model/Model";

export default function ModelEdit({
  modelId,
}: {
  modelId: string;
}) {
  return <Model modelId={modelId} />;
}
