/**
 * app/(main)/management/pricing/page.tsx
 * Pricing page for the user.
 * @AshokSaravanan222 & @siladiea
 * 08/10/2025
 */
import Pricing from "@/components/management/pricing/Pricing";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pricing",
  description: `Manage pricing for GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
};

export default function PricingPage() {
  return (
    <div className="space-y-6">
      <Pricing />
    </div>
  );
}
