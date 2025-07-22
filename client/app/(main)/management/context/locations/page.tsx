/**
 * app/(main)/management/context/locations/page.tsx
 * Context locations page - redirects to home with context section
 * @AshokSaravanan222 & @siladiea
 * 07/21/2025
 */
import ContextLocations from "@/components/management/context/ContextLocations";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Context Locations",
  description: `Manage context locations in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
};

export default function ContextLocationsPage() {
  return (
    <div className="space-y-6">
      <ContextLocations />
    </div>
  );
}
