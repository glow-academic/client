/**
 * app/(main)/management/classes/page.tsx
 * Classes page for the management section.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import Classes from "@/components/classes/Classes";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Classes",
  description: `Classes in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
};

export default function ClassesPage() {
  return (
    <div className="space-y-6">
      <Classes />
    </div>
  );
}
