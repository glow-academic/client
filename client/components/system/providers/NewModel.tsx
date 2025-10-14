/**
 * NewModel.tsx
 * Used to display the new model page.
 * @AshokSaravanan222 & @siladiea
 * 06/18/2025
 */
"use client";
import Model from "@/components/common/model/Model";

export interface NewModelProps {
  providerId: string;
}

export default function NewModel({ providerId }: NewModelProps) {
  return <Model providerId={providerId} />;
}
