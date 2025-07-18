/**
 * app/(main)/management/departments/new/page.tsx
 * New department page for the user.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import NewDepartment from "@/components/management/departments/NewDepartment";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Departments",
  description: `Create new department in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
};

export default function NewDepartmentPage() {
  return (
    <div className="space-y-6">
      <NewDepartment />
    </div>
  );
}
