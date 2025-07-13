/**
 * app/(main)/classes/new/page.tsx
 * New class page for the classes section.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */
import NewClass from "@/components/create/classes/NewClass";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "New Class",
  description: `New class creation page for the classes section in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
};

export default function NewClassPage() {
  return (
    <div className="space-y-6">
      <NewClass />
    </div>
  );
}
