/**
 * app/(main)/management/context/documents/page.tsx
 * Context documents page - redirects to home with context section
 * @AshokSaravanan222 & @siladiea
 * 07/21/2025
 */
import ContextDocuments from "@/components/management/context/ContextDocuments";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Context Documents",
  description: `Manage context documents in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
};

export default function ContextDocumentsPage() {
  return (
    <div className="space-y-6">
      <ContextDocuments />
    </div>
  );
}
