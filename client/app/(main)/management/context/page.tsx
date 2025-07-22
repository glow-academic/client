/**
 * app/(main)/management/context/page.tsx
 * Context list page - redirects to home with context section
 * @AshokSaravanan222 & @siladiea
 * 07/21/2025
 */
import Context from "@/components/management/context/Context";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Context",
  description: `Manage context in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
};

export default function ContextPage() {
  return (
    <div className="space-y-6">
      <Context />
    </div>
  );
}
