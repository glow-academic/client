/**
 * app/(main)/management/context/deadlines/page.tsx
 * Context deadlines page - redirects to home with context section
 * @AshokSaravanan222 & @siladiea
 * 07/21/2025
 */
import ContextDeadlines from "@/components/management/context/ContextDeadlines";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Context Deadlines",
  description: `Manage context deadlines in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
};

export default function ContextDeadlinesPage() {
  return (
    <div className="space-y-6">
      <ContextDeadlines />
    </div>
  );
}
