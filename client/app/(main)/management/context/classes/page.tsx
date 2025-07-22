/**
 * app/(main)/management/context/classes/page.tsx
 * Context classes page - redirects to home with context section
 * @AshokSaravanan222 & @siladiea
 * 07/21/2025
 */
import ContextClasses from "@/components/management/context/ContextClasses";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Context Classes",
  description: `Manage context classes in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
};

export default function ContextClassesPage() {
  return (
    <div className="space-y-6">
      <ContextClasses />
    </div>
  );
}
