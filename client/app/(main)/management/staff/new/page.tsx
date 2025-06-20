/**
 * app/(main)/management/staff/new/page.tsx
 * New staff page for the user.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import NewStaff from "@/components/management/staff/NewStaff";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Staff",
  description: "Create new staff in GLOW (Graduate Learning Orientation Workshop) at Purdue University.",
};

export default function NewStaffPage() {
  return (
    <div className="space-y-6">
      <NewStaff />
    </div>
  );
}
