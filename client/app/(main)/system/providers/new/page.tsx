/**
 * app/(main)/system/providers/new/page.tsx
 * New provider page for the providers section.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import NewProvider from "@/components/system/providers/NewProvider";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Providers",
  description: `Create new AI providers in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
};

export default function NewProviderPage() {
  return (
    <div className="space-y-6">
      <NewProvider />
    </div>
  );
}
