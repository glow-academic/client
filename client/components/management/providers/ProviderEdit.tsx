/**
 * ProviderEdit.tsx
 * Used to display the edit provider page.
 * @AshokSaravanan222 & @siladiea
 * 06/18/2025
 */
"use client";
import Provider from "@/components/common/provider/Provider";

export interface ProviderEditProps {
  providerId: string;
}

export default function ProviderEdit({ providerId }: ProviderEditProps) {
  return <Provider providerId={providerId} />;
}
