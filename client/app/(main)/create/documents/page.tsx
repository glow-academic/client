/**
 * app/(main)/create/documents/page.tsx
 * Documents list page - redirects to home with documents section
 * @AshokSaravanan222 & @siladiea
 * 06/09/2025
 */

import Documents from "@/components/create/documents/Documents";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Documents",
  description: `Documents in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
};

export default function DocumentsPage() {
  return (
    <div className="space-y-6">
      <Documents />
    </div>
  );
}
