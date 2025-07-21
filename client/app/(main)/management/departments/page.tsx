/**
 * app/(main)/management/staff/page.tsx
 * Staff page for the user.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import DepartmentsGeneralPage from "@/components/management/departments/Departments";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Staff",
  description: `Manage staff in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
};

export default function StaffPage() {
  return (
    <div className="space-y-6">
      <DepartmentsGeneralPage />
    </div>
  );
}
