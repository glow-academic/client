/**
 * ModelEdit.tsx
 * Used to display the edit model page.
 * @AshokSaravanan222 & @siladiea
 * 06/18/2025
 */
"use client";
import Model from "@/components/common/model/Model";

export interface ModelEditProps {
  modelId: string;
}

export default function ModelEdit({
  modelId,
}: ModelEditProps) {
  return <Model modelId={modelId} />;
}
