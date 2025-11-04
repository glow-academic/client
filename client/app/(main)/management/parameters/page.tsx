/**
 * app/(main)/management/parameters/page.tsx
 * Parameters list page
 * @AshokSaravanan222 & @siladiea
 * 07/21/2025
 */
import Parameters from "@/components/parameters/Parameters";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Parameters",
  description: `Manage parameters in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
};

export default function ContextPage() {
  return (
    <div className="space-y-6">
      <Parameters />
    </div>
  );
}
