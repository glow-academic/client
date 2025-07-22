/**
 * app/(main)/management/context/time/page.tsx
 * Context time page - redirects to home with context section
 * @AshokSaravanan222 & @siladiea
 * 07/21/2025
 */
import ContextTime from "@/components/management/context/ContextTime";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Context Time",
  description: `Manage context time in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
};

export default function ContextTimePage() {
  return (
    <div className="space-y-6">
      <ContextTime />
    </div>
  );
}
