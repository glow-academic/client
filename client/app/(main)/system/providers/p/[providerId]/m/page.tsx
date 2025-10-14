/**
 * app/(main)/system/providers/p/[providerId]/m/page.tsx
 * Model edit page for the providers section.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import { redirect } from "next/navigation";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Providers",
  description: `Manage individual AI providers in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
};

export default function ProviderEditPage() {
  return redirect("/system/providers");
}
