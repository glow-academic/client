/**
 * app/(main)/management/staff/page.tsx
 * Staff page for the user.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import Staff from "@/components/management/staff/Staff";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Staff",
  description: `Manage staff in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
};

export default function StaffPage() {
  return (
    <div className="space-y-6">
      <Staff />
    </div>
  );
}
