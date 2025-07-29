/**
 * app/(main)/management/parameters/new/page.tsx
 * New parameter page for the parameters section.
 * @AshokSaravanan222 & @siladiea
 * 07/26/2025
 */

import NewParameter from "@/components/common/parameter/Parameter";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "New Parameter",
  description: `New parameter creation page for the parameters section in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
};

export default function NewParameterPage() {
  return (
    <div className="space-y-6">
      <NewParameter mode="create" />
    </div>
  );
}
