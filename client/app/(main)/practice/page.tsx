/**
 * app/(main)/practice/page.tsx
 * Practice page for the user.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import Practice from "@/components/practice/Practice";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Practice",
  description: `Practice page for GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
};

export default function HomePage() {
  return (
    <div className="space-y-6">
      <Practice />
    </div>
  );
}
