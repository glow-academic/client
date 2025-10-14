/**
 * app/(main)/system/providers/page.tsx
 * Providers list page - redirects to home with providers section
 * @AshokSaravanan222 & @siladiea
 * 06/18/2025
 */
import Providers from "@/components/system/providers/Providers";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Providers",
  description: `Manage AI providers in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
};

export default function ProvidersPage() {
  return (
    <div className="space-y-6">
      <Providers />
    </div>
  );
}
